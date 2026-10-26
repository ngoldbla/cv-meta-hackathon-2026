"""Event-driven elevator-group simulator with explicit crowd failure mechanics.

Design notes
------------
* Conventional hall calls: one call per (floor, direction), however many people wait behind
  it (W1).  The controller never sees queue lengths unless it is explicitly omniscient.
* A call is cancelled when any car opens its doors at that landing in that direction, even if
  the car is full; stranded passengers re-register after a random delay (W2).
* Cars run collective (directional) control over their car calls and assigned hall calls.
  New stops can be accepted en route only at floors the car can still decelerate for.
* Every run keeps two records: passenger-level ground truth and the controller "logger view"
  (call registration/cancellation and door events), so log-based KPIs can be audited.
* All stochastic draws inside the simulator are keyed by (seed, purpose, entity, counter), so
  cloned simulations that take different actions still share common random numbers.
"""

from __future__ import annotations

import copy
import heapq
import math
from collections import deque
from dataclasses import dataclass, field

import numpy as np

from .building import CLASSES, Building

UP, DOWN, IDLE = 1, -1, 0

# purpose ids for keyed random streams
_P_REPRESS, _P_REOPEN, _P_PRESS = 1, 2, 3


@dataclass
class Passenger:
    pid: int
    t_arrive: float
    origin: int
    dest: int
    klass: str = "adult"
    stream: str = ""
    t_board: float | None = None
    t_alight: float | None = None
    car: int | None = None
    n_left_behind: int = 0

    @property
    def direction(self) -> int:
        return UP if self.dest > self.origin else DOWN

    @property
    def mass(self) -> float:
        return CLASSES[self.klass].mass

    @property
    def area(self) -> float:
        return CLASSES[self.klass].area


@dataclass
class HallCall:
    cid: int
    floor: int
    direction: int
    t_register: float
    car: int | None = None
    t_cancel: float | None = None
    n_reassign: int = 0


@dataclass
class Car:
    idx: int
    floor: int = 0
    direction: int = IDLE
    moving: bool = False
    doors_open: bool = False
    serve_dir: int = IDLE
    leg_from: int = 0
    leg_t0: float = 0.0
    leg_target: int = 0
    leg_id: int = 0
    parking_leg: bool = False
    parking_target: int | None = None
    door_version: int = 0
    door_close_at: float = 0.0
    car_calls: set = field(default_factory=set)
    hall_calls: set = field(default_factory=set)
    onboard: list = field(default_factory=list)
    load_mass: float = 0.0
    load_area: float = 0.0
    asleep: bool = False
    waking: bool = False
    idle_since: float = 0.0
    idle_token: int = 0
    floors_travelled: float = 0.0
    n_starts: int = 0
    n_stops: int = 0
    n_wasted_stops: int = 0

    def has_work(self) -> bool:
        return bool(self.car_calls or self.hall_calls or self.onboard)


class Simulation:
    """Discrete-event simulation of one elevator bank over one scenario."""

    def __init__(self, scenario, controller, seed: int | None = None, record_trace: bool = False):
        self.scenario = scenario
        self.b: Building = scenario.building_effective()
        self.kin = self.b.kin
        self.seed = int(scenario.seed if seed is None else seed)
        self.controller = controller
        self.now = 0.0
        self._heap: list = []
        self._seq = 0
        self.pax: dict[int, Passenger] = {}
        self.done: list[Passenger] = []
        self.queues: dict[tuple[int, int], deque] = {}
        self.active_calls: dict[tuple[int, int], HallCall] = {}
        self.call_log: list[HallCall] = []
        self.door_log: list[tuple] = []  # (car, floor, t_open, t_close, n_in, n_out, load_mass)
        self._next_cid = 0
        self._next_pid = 0
        self.cars = [Car(idx=i) for i in range(self.b.n_cars)]
        self.lobby_occ = 0.0
        self._lobby_t = 0.0
        self.peak_density: dict[int, float] = {}
        self.peak_lobby_density = 0.0
        self.danger_time: dict[int, float] = {}  # s with landing density >= building.rho_danger
        self._dens_state: dict[int, tuple[float, float]] = {}
        self.record_trace = record_trace
        self.trace: list[dict] = []
        self.decision_hook = None  # callable(sim, call) -> None, called before assignment
        self._pending_arrivals = 0
        self.t_end: float | None = None
        self.deadlocked = False
        for i, c in enumerate(self.cars):
            c.floor = scenario.init_floor(i)
            c.asleep = scenario.init_asleep(i)
        for p in scenario.sample_passengers(np.random.default_rng([self.seed, 0])):
            self._add_passenger(p)
        controller.reset(self)
        for c in self.cars:
            self._schedule_parkcheck(c, 0.0)

    # ------------------------------------------------------------------ utilities
    def _push(self, t: float, kind: str, *payload) -> None:
        self._seq += 1
        heapq.heappush(self._heap, (t, self._seq, kind, payload))

    def _rng(self, purpose: int, *keys: int) -> np.random.Generator:
        return np.random.default_rng([self.seed, purpose, *[int(k) for k in keys]])

    def _add_passenger(self, p: Passenger) -> None:
        p.pid = self._next_pid
        self._next_pid += 1
        self.pax[p.pid] = p
        self._pending_arrivals += 1
        self._push(p.t_arrive, "arrive", p.pid)

    def car_position(self, i: int) -> float:
        """Fractional floor position of car ``i`` (observable)."""
        c = self.cars[i]
        if not c.moving:
            return float(c.floor)
        dist = abs(c.leg_target - c.leg_from)
        x = self.kin.position(dist, self.now - c.leg_t0)
        return c.leg_from + c.direction * x

    def waiting_count(self, floor: int, direction: int) -> int:
        """Ground truth queue length (NOT observable by a real controller)."""
        q = self.queues.get((floor, direction))
        return len(q) if q else 0

    def landing_count(self, floor: int) -> int:
        return self.waiting_count(floor, UP) + self.waiting_count(floor, DOWN)

    def _lobby_now(self) -> float:
        drained = self.b.exit_rate * (self.now - self._lobby_t)
        self.lobby_occ = max(0.0, self.lobby_occ - drained)
        self._lobby_t = self.now
        return self.lobby_occ

    def landing_density(self, floor: int) -> float:
        """People per m^2 on a landing, capped at the physical crush limit (queues spill back)."""
        dens = self.landing_count(floor) / self.b.landing_area(floor)
        if floor == self.b.lobby_floor:
            dens += self._lobby_now() / self.b.lobby_area
        return min(dens, self.b.rho_crush)

    def _note_density(self, floor: int) -> None:
        dens = self.landing_density(floor)
        prev = self._dens_state.get(floor)
        if prev is not None and prev[1] >= self.b.rho_danger:
            self.danger_time[floor] = self.danger_time.get(floor, 0.0) + (self.now - prev[0])
        self._dens_state[floor] = (self.now, dens)
        if floor == self.b.lobby_floor:
            self.peak_lobby_density = max(self.peak_lobby_density, dens)
        if dens > self.peak_density.get(floor, 0.0):
            self.peak_density[floor] = dens

    # ------------------------------------------------------------------ main loop
    def run(self, until: float | None = None) -> Simulation:
        t_max = self.scenario.t_max
        heap = self._heap
        while heap:
            t = heap[0][0]
            if until is not None and t > until:
                self.now = until
                return self
            if t > t_max:
                break
            _, _, kind, payload = heapq.heappop(heap)
            self.now = t
            getattr(self, "_on_" + kind)(*payload)
            if self._pending_arrivals == 0 and not self.pax:
                self.t_end = self.now
                return self
        self.t_end = min(self.now if not heap else t_max, t_max)
        if not heap and not self.finished():
            self.deadlocked = True
        return self

    def finished(self) -> bool:
        return self._pending_arrivals == 0 and not self.pax

    # ------------------------------------------------------------------ passengers & calls
    def _on_arrive(self, pid: int) -> None:
        p = self.pax[pid]
        self._pending_arrivals -= 1
        key = (p.origin, p.direction)
        self.queues.setdefault(key, deque()).append(pid)
        self._note_density(p.origin)
        # late boarding into a car whose doors are still open in our direction
        for c in self.cars:
            if c.doors_open and c.floor == p.origin and c.serve_dir == p.direction and self._fits(c, p):
                self._board(c, p, self.now + self.kin.t_board)
                self.queues[key].remove(pid)
                c.door_close_at = max(c.door_close_at, self.now + self.kin.t_board)
                self._reschedule_close(c)
                return
        if key not in self.active_calls:
            q = len(self.queues[key])
            if q <= 1 or self._rng(_P_PRESS, pid).random() < math.exp(-(q - 1) / self.b.press_kappa):
                self._register_call(*key)

    def _on_repress(self, pid: int, k: int) -> None:
        p = self.pax.get(pid)
        if p is None or p.t_board is not None or p.n_left_behind != k:
            return
        key = (p.origin, p.direction)
        if key in self.active_calls:
            return
        busy = [c for c in self.cars if c.doors_open and c.floor == p.origin and c.serve_dir == p.direction]
        if busy:
            # a (full) car is still loading here: try again once its doors have closed
            t_retry = max(c.door_close_at for c in busy) + self.kin.t_door_close + 0.1
            self._push(max(t_retry, self.now + 0.1), "repress", pid, k)
            return
        self._register_call(*key)

    def _register_call(self, floor: int, direction: int) -> None:
        call = HallCall(self._next_cid, floor, direction, self.now)
        self._next_cid += 1
        self.active_calls[(floor, direction)] = call
        self.call_log.append(call)
        if self.decision_hook is not None:
            self.decision_hook(self, call)
        self._dispatch(call, exclude=())

    def _dispatch(self, call: HallCall, exclude=()) -> None:
        ci = int(self.controller.assign(self, call, exclude=exclude))
        if not 0 <= ci < len(self.cars) or ci in exclude:
            ci = min((i for i in range(len(self.cars)) if i not in exclude), key=lambda i: abs(self.car_position(i) - call.floor))
        self.assign(call, ci)

    def assign(self, call: HallCall, ci: int) -> None:
        call.car = ci
        c = self.cars[ci]
        c.hall_calls.add((call.floor, call.direction))
        if self.record_trace:
            self.trace.append({"t": self.now, "ev": "assign", "car": ci, "floor": call.floor, "dir": call.direction})
        if c.parking_leg:
            c.parking_target = None
        if not c.moving and not c.doors_open:
            self._car_next(c)

    def _cancel_call(self, floor: int, direction: int) -> None:
        call = self.active_calls.pop((floor, direction), None)
        if call is None:
            return
        call.t_cancel = self.now
        for c in self.cars:
            c.hall_calls.discard((floor, direction))

    # ------------------------------------------------------------------ car logic
    def _fits(self, c: Car, p: Passenger) -> bool:
        return c.load_mass + p.mass <= self.b.rated_mass + 1e-9 and c.load_area + p.area <= self.b.car_area + 1e-9

    def _stops_ahead(self, c: Car, pos: int, d: int, include_reverse: bool = True) -> list[int]:
        out = [f for f in c.car_calls if (f - pos) * d > 0]
        for f, dd in c.hall_calls:
            if (f - pos) * d > 0 and (dd == d or include_reverse):
                out.append(f)
        return out

    def _next_target(self, c: Car):
        """Collective control.  Returns ('here', serve_dir) | ('go', floor, dir) | None."""
        p = c.floor
        dirs = [c.direction, -c.direction] if c.direction != IDLE else []
        if c.direction == IDLE:
            for d in (UP, DOWN):
                if (p, d) in c.hall_calls:
                    return ("here", d)
            cands = list(c.car_calls) + [f for f, _ in c.hall_calls]
            if not cands:
                return None
            nearest = min(cands, key=lambda f: (abs(f - p), f))
            if nearest == p:
                return ("here", UP if (p, UP) in c.hall_calls else DOWN)
            dirs = [UP if nearest > p else DOWN]
            dirs.append(-dirs[0])
        for d in dirs:
            same = [f for f in c.car_calls if (f - p) * d > 0] + [f for f, dd in c.hall_calls if dd == d and (f - p) * d > 0]
            if same:
                return ("go", min(same, key=lambda f: abs(f - p)), d)
            rev = [f for f, dd in c.hall_calls if dd == -d and (f - p) * d > 0]
            if rev:
                return ("go", max(rev, key=lambda f: abs(f - p)), d)
            if (p, -d) in c.hall_calls:
                return ("here", -d)
            if (p, d) in c.hall_calls:
                return ("here", d)
        return None

    def _car_next(self, c: Car) -> None:
        if c.moving or c.doors_open:
            return
        nxt = self._next_target(c)
        if nxt is None and c.parking_target is not None and c.parking_target != c.floor:
            nxt = ("park", c.parking_target, UP if c.parking_target > c.floor else DOWN)
        if nxt is None:
            if c.direction != IDLE or c.parking_leg:
                c.direction = IDLE
                c.parking_leg = False
                c.parking_target = None
                c.idle_since = self.now
                self._schedule_parkcheck(c, self.controller.park_delay)
            return
        if c.asleep:
            if not c.waking:
                c.waking = True
                self._push(self.now + self.b.t_wake, "wake", c.idx)
            return
        if nxt[0] == "here":
            c.direction = nxt[1]
            self._open_doors(c, nxt[1])
            return
        _, target, d = nxt
        self._start_leg(c, target, d, parking=nxt[0] == "park")

    def _start_leg(self, c: Car, target: int, d: int, parking: bool = False) -> None:
        c.moving = True
        c.direction = d
        c.parking_leg = parking
        c.leg_from = c.floor
        c.leg_t0 = self.now
        c.leg_target = target
        c.leg_id += 1
        c.n_starts += 1
        dist = abs(target - c.floor)
        self._push(self.now + self.kin.flight_time(dist), "reach", c.idx, target, c.leg_id)
        for k in range(1, dist):
            if self.kin.can_stop_en_route(k):
                self._push(self.now + self.kin.commit_offset(k), "commit", c.idx, c.floor + d * k, c.leg_id)
        if self.record_trace:
            self.trace.append({"t": self.now, "ev": "depart", "car": c.idx, "from": c.floor, "to": target})

    def _on_commit(self, ci: int, f: int, leg_id: int) -> None:
        c = self.cars[ci]
        if leg_id != c.leg_id or not c.moving:
            return
        d = c.direction
        stop = f in c.car_calls
        if not stop and (f, d) in c.hall_calls:
            stop = True
            if f not in c.car_calls and c.load_mass >= self.b.bypass_frac * self.b.rated_mass:
                # load-weighing bypass: pass the landing and hand the call back for reassignment
                stop = False
                c.hall_calls.discard((f, d))
                call = self.active_calls.get((f, d))
                if call is not None:
                    call.n_reassign += 1
                    self._dispatch(call, exclude=(ci,))
        if not stop and (f, -d) in c.hall_calls and not self._stops_ahead(c, f, d):
            stop = True  # reversal floor reached earlier than the planned target
        if not stop and c.parking_leg and c.has_work() and not self._stops_ahead(c, f, d):
            stop = True  # interrupt standby/parking movement
        if stop:
            c.leg_target = f
            c.leg_id += 1
            self._push(self.now + self.kin.t_decel, "reach", ci, f, c.leg_id)

    def _on_reach(self, ci: int, f: int, leg_id: int) -> None:
        c = self.cars[ci]
        if leg_id != c.leg_id:
            return
        c.moving = False
        c.floors_travelled += abs(f - c.leg_from)
        c.floor = f
        was_parking = c.parking_leg
        c.parking_leg = False
        if was_parking and c.parking_target == f:
            c.parking_target = None
        d = c.direction
        waiting_here = self.waiting_count(f, UP) + self.waiting_count(f, DOWN)
        service = f in c.car_calls or (f, d) in c.hall_calls or (f, -d) in c.hall_calls or waiting_here > 0
        if not service:
            self._car_next(c)
            return
        c.n_stops += 1
        if (f, d) in c.hall_calls or self._stops_ahead(c, f, d):
            serve = d
        elif (f, -d) in c.hall_calls or self._stops_ahead(c, f, -d):
            serve = -d
        else:
            serve = d if self.waiting_count(f, d) or not self.waiting_count(f, -d) else -d
        self._open_doors(c, serve)

    def _open_doors(self, c: Car, serve: int) -> None:
        kin = self.kin
        f = c.floor
        c.doors_open = True
        c.serve_dir = serve
        c.direction = serve
        self._cancel_call(f, serve)
        c.car_calls.discard(f)
        t = self.now + kin.t_door_open
        # alight
        out = [pid for pid in c.onboard if self.pax[pid].dest == f]
        n_out = len(out)
        t_out = n_out * kin.t_alight
        if out and f == self.b.lobby_floor:
            occ = self._lobby_now()
            room = max(0.0, self.b.rho_block * self.b.lobby_area - occ - self.landing_count(f))
            if n_out > room:
                t_out = max(t_out, (n_out - room) / max(self.b.exit_rate, 1e-6))
        for k, pid in enumerate(out):
            p = self.pax.pop(pid)
            p.t_alight = t + (k + 1) * (t_out / max(n_out, 1))
            c.onboard.remove(pid)
            c.load_mass -= p.mass
            c.load_area -= p.area
            self.done.append(p)
        if out and f == self.b.lobby_floor:
            self.lobby_occ += n_out
            self._note_density(f)
        t += t_out
        # board (FIFO, people who do not fit are left behind; others may squeeze past them)
        q = self.queues.get((f, serve))
        n_in = 0
        left = []
        crowd_before = self.landing_count(f)
        if q:
            remaining = deque()
            while q:
                pid = q.popleft()
                p = self.pax[pid]
                if self._fits(c, p):
                    t += kin.t_board
                    self._board(c, p, t)
                    n_in += 1
                else:
                    remaining.append(pid)
            self.queues[(f, serve)] = remaining
            left = list(remaining)
        for pid in left:
            p = self.pax[pid]
            p.n_left_behind += 1
            delay = self._rng(_P_REPRESS, pid, p.n_left_behind).exponential(self.b.repress_delay_mean)
            self._push(self.now + 0.5 + delay, "repress", pid, p.n_left_behind)
        # held doors (W4)
        extra = 0.0
        if self.b.hold_rate > 0 and (left or crowd_before >= self.b.hold_queue):
            lam = self.b.hold_rate * min(2.0, max(crowd_before / max(self.b.hold_queue, 1), 1.0 if left else 0.0))
            n_reopen = int(self._rng(_P_REOPEN, c.idx, c.n_stops, f).poisson(lam))
            extra = n_reopen * (kin.t_reopen + kin.t_door_open)
        transfer = t - (self.now + kin.t_door_open)
        c.door_close_at = self.now + kin.t_door_open + max(kin.t_dwell_min, transfer) + extra
        if n_in == 0 and n_out == 0:
            c.n_wasted_stops += 1
        self.door_log.append((c.idx, f, self.now, c.door_close_at + kin.t_door_close, n_in, n_out, c.load_mass))
        if self.record_trace:
            self.trace.append({"t": self.now, "ev": "doors", "car": c.idx, "floor": f, "in": n_in, "out": n_out, "left": len(left)})
        self._reschedule_close(c)
        self._note_density(f)

    def _board(self, c: Car, p: Passenger, t_board: float) -> None:
        p.t_board = t_board
        p.car = c.idx
        c.onboard.append(p.pid)
        c.load_mass += p.mass
        c.load_area += p.area
        c.car_calls.add(p.dest)

    def _reschedule_close(self, c: Car) -> None:
        c.door_version += 1
        self._push(c.door_close_at + self.kin.t_door_close, "close", c.idx, c.door_version)

    def _on_close(self, ci: int, version: int) -> None:
        c = self.cars[ci]
        if version != c.door_version or not c.doors_open:
            return
        c.doors_open = False
        if not c.has_work():
            c.direction = IDLE
            c.idle_since = self.now
            self._schedule_parkcheck(c, self.controller.park_delay)
        self._car_next(c)

    def _on_wake(self, ci: int) -> None:
        c = self.cars[ci]
        c.asleep = False
        c.waking = False
        self._car_next(c)

    def _schedule_parkcheck(self, c: Car, delay: float) -> None:
        c.idle_token += 1
        self._push(self.now + delay, "parkcheck", c.idx, c.idle_token)

    def _on_parkcheck(self, ci: int, token: int) -> None:
        c = self.cars[ci]
        if token != c.idle_token or c.moving or c.doors_open or c.has_work():
            return
        target = self.controller.park(self, ci)
        if target is not None and target != c.floor:
            c.parking_target = int(target)
            self._car_next(c)
        elif target is None and math.isfinite(self.b.sleep_after) and not c.asleep:
            self._push(self.now + self.b.sleep_after, "sleepcheck", ci, c.idle_token)

    def _on_sleepcheck(self, ci: int, token: int) -> None:
        """Energy saving (W6): long-idle cars return to the far side; some shut down."""
        c = self.cars[ci]
        if token != c.idle_token or c.moving or c.doors_open or c.has_work() or c.asleep:
            return
        if c.floor != self.b.return_floor:
            c.parking_target = self.b.return_floor
            self._car_next(c)
        elif ci < self.b.n_sleepers:
            c.asleep = True

    # ------------------------------------------------------------------ cloning (counterfactual rollouts)
    def clone(self) -> Simulation:
        """Deep copy of the live state; delivered passengers and logs are shared, not copied."""
        saved = (self.done, self.call_log, self.door_log, self.trace, self.decision_hook)
        self.done, self.call_log, self.door_log, self.trace, self.decision_hook = [], [], [], [], None
        try:
            other = copy.deepcopy(self)
        finally:
            self.done, self.call_log, self.door_log, self.trace, self.decision_hook = saved
        other.call_log = list(self.call_log)
        return other

    def resample_future(self, seed: int) -> None:
        """Replace not-yet-arrived passengers with a fresh conditional draw (same for every action)."""
        future = {pid for pid, p in self.pax.items() if p.t_arrive > self.now}
        for pid in future:
            del self.pax[pid]
        self._heap = [e for e in self._heap if not (e[2] == "arrive" and e[3][0] in future)]
        heapq.heapify(self._heap)
        self._pending_arrivals -= len(future)
        arrived = {}
        for p in list(self.pax.values()) + self.done:
            arrived[p.stream] = arrived.get(p.stream, 0) + 1
        rng = np.random.default_rng([self.seed, 99, int(seed)])
        for p in self.scenario.sample_future(rng, self.now, arrived):
            self._add_passenger(p)


def waiting_cost(sim: Simulation, t0: float, t1: float, tau: float = 60.0) -> float:
    """Tail-aware waiting cost accrued in [t0, t1]: integral of (1 + w/tau) dw over each wait.

    Squared-wait style costs penalize long waits (cf. Crites & Barto 1996)."""
    cost = 0.0
    for p in list(sim.pax.values()) + sim.done:
        start = max(p.t_arrive, t0)
        end = min(p.t_board if p.t_board is not None else t1, t1)
        if end <= start:
            continue
        w0, w1 = start - p.t_arrive, end - p.t_arrive
        cost += (w1 - w0) + (w1 * w1 - w0 * w0) / (2 * tau)
    return cost


def is_finite(x: float) -> bool:
    return not (math.isnan(x) or math.isinf(x))
