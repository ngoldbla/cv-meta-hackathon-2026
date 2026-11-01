"""Event-driven simulation of a subway line under an emergency evacuation.

Trains circulate on two tracks with terminal turnbacks and cannot overtake: each segment and each
direction-platform holds one train (fixed-block signalling).  Dwell grows with boarding and alighting
and with doors held open.  Evacuees reach the event station's entrance, pass stairs and fare arrays
into the platform level (spilling back outside when the platform is at crush density) and board in
FIFO order.  Spare trains wait in the yard and shuttle buses at a depot.

Two truths are recorded: each passenger's true wait (from reaching the station to boarding) and the
operator's logged view (half the observed headway per boarding, no left-behinds), which is all that
train logs and passenger counters can see when fare gates are open.

When a direction-platform becomes crowded, a coarse, delayed **alert** is raised; the controller
answers it by choosing one of a fixed set of candidate vehicles (slots): no extra action, one of the
nearest trains sent express (skipping stops) to the alert, a yard train, or a shuttle bus.
"""

from __future__ import annotations

import copy
import heapq
from collections import deque
from dataclasses import dataclass, field

import numpy as np

from .line import CLASS_BOARD, CLASS_UNITS, DOWN, UP, Line

N_SLOTS = 8  # 0 = no action, 1-4 = nearest trains express, 5 = yard train, 6-7 = buses
TRAIN_SLOTS = (1, 2, 3, 4)
YARD_SLOT = 5
BUS_SLOTS = (6, 7)
CLASSES = ("adult", "wheelchair")


@dataclass(frozen=True, slots=True)
class Passenger:
    pid: int
    t_arrive: float
    origin: int
    dest: int
    klass: str = "adult"
    stream: str = ""

    @property
    def direction(self) -> int:
        return UP if self.dest > self.origin else DOWN

    @property
    def units(self) -> float:
        return CLASS_UNITS[self.klass]


@dataclass(slots=True)
class Boarded:
    pid: int
    t_arrive: float
    t_board: float
    origin: int
    dest: int
    klass: str
    stream: str
    vehicle: str
    n_left_behind: int
    logged_wait: float
    t_platform: float | None = None  # None: boarded a bus from outside the station


@dataclass
class Call:
    cid: int
    station: int
    direction: int
    t_register: float
    level: int
    slots: tuple = ()  # N_SLOTS entries: (kind, index) or None
    choice: int | None = None
    vehicle: tuple | None = None
    t_cancel: float | None = None


@dataclass
class Train:
    idx: int
    state: str = "yard"  # service | turnback | yard | crewing | entering
    station: int = 0
    direction: int = UP
    at_rest: bool = True
    planned_stop: bool = True
    blocked: bool = False
    serving: bool = False  # doors opened at the current station
    topup: bool = False  # held at a terminal: board once more before leaving
    express_to: tuple | None = None
    call_cid: int | None = None
    onboard: list = field(default_factory=list)  # space units by destination station
    missed: dict = field(default_factory=dict)  # dest -> units carried past their stop
    load: float = 0.0
    n_stops: int = 0
    n_skips: int = 0
    km: float = 0.0


@dataclass
class Bus:
    idx: int
    state: str = "depot"  # depot | crewing | driving | idle
    pos_m: float = 0.0
    offset: float = 0.0  # lateral distance to the line's road
    shuttle: tuple | None = None  # (station, direction) it serves
    onboard: list = field(default_factory=list)  # (dest, units, pid) carried to the hub
    trips: int = 0
    version: int = 0


class Simulation:
    def __init__(self, scenario, controller, seed: int | None = None, record_trace: bool = False):
        self.scenario = scenario
        self.controller = controller
        self.L: Line = scenario.line_effective()
        self.seed = int(scenario.seed if seed is None else seed)
        self.now = 0.0
        self.t_max = float(scenario.t_max)
        self.t_onset = float(scenario.t_onset)
        self._heap: list = []
        self._seq = 0
        S = self.L.n_stations
        keys = [(s, d) for s in range(S) for d in (UP, DOWN)]
        self.pax: dict[int, Passenger] = {}
        self.done: list[Boarded] = []
        self.outside = {k: deque() for k in keys}
        self.platq = {k: deque() for k in keys}
        self.t_plat: dict[int, tuple] = {}  # pid -> (t on platform, departures seen at entry)
        self.plat_units = dict.fromkeys(keys, 0.0)
        self.dep_count = dict.fromkeys(keys, 0)
        self.last_dep: dict = {}
        self.last_bus_dep: dict = {}
        self.entry_busy = [False] * S
        self.entry_blocked = [False] * S
        self.plat_occ: dict = {}
        self.seg_occ: dict = {}
        self.waiters: dict = {}
        self.term_dep: dict = {}
        self.active_calls: dict[tuple, Call] = {}
        self.pending_alert: set = set()
        self.quiet_until: dict = {}
        self.n_wait = 0
        self.call_log: list[Call] = []
        self._next_cid = 0
        self._next_pid = 0
        self._pending_arrivals = 0
        self.arrived_by_stream: dict[str, int] = {}
        self.peak_density: dict = {}
        self.danger_time: dict = {}
        self._dens: dict = {}
        self.record_trace = record_trace
        self.trace: list[dict] = []
        self.decision_hook = None  # callable(sim, call), called before the controller decides
        self.declared = False
        self.t_end: float | None = None
        self.deadlocked = False
        self.n_backtrack = 0
        self.bus_boarded = 0
        L = self.L
        self.trains = [Train(idx=i, onboard=[0.0] * S) for i in range(L.n_service + L.n_yard)]
        self.buses = [Bus(idx=i, pos_m=L.depot_pos_m, offset=L.depot_offset_m) for i in range(L.n_buses)]
        self._place_service_trains()
        self._add_passengers(scenario.sample_passengers(np.random.default_rng([self.seed, 0])))
        self._push(self.t_onset, "declare")
        controller.reset(self)

    # ------------------------------------------------------------------ utilities
    def _push(self, t: float, kind: str, *payload) -> None:
        self._seq += 1
        heapq.heappush(self._heap, (t, self._seq, kind, payload))

    def _rng(self, purpose: int, *keys: int) -> np.random.Generator:
        return np.random.default_rng([self.seed, purpose, *[int(k) for k in keys]])

    def _add_passengers(self, batch: dict) -> None:
        for t, o, d, k, name in zip(batch["t"], batch["o"], batch["d"], batch["k"], batch["stream"], strict=True):
            p = Passenger(self._next_pid, float(t), int(o), int(d), CLASSES[int(k)], str(name))
            self._next_pid += 1
            self.pax[p.pid] = p
            self._pending_arrivals += 1
            self._push(p.t_arrive, "arrive", p.pid)

    def _new_passenger(self, origin: int, dest: int, stream: str, klass: str = "adult") -> Passenger:
        p = Passenger(self._next_pid, self.now, origin, dest, klass, stream)
        self._next_pid += 1
        self.pax[p.pid] = p
        return p

    def loop_coord(self, s: int, d: int) -> float:
        """Position on the circulation loop: up track 0..len, then down track back to 0."""
        span = self.L.pos_m[-1]
        return self.L.pos_m[s] if d == UP else 2 * span - self.L.pos_m[s]

    def train_coord(self, t: Train) -> float:
        return self.loop_coord(t.station, t.direction)

    def loop_distance(self, t: Train, s: int, d: int) -> float:
        span2 = 2 * self.L.pos_m[-1]
        return (self.loop_coord(s, d) - self.train_coord(t)) % span2

    def waiting_count(self, s: int, d: int) -> int:
        return len(self.platq[(s, d)]) + len(self.outside[(s, d)])

    def outside_count(self, s: int) -> int:
        return len(self.outside[(s, UP)]) + len(self.outside[(s, DOWN)])

    def platform_density(self, s: int, d: int) -> float:
        return self.plat_units[(s, d)] / self.L.platform_area[s]

    def plaza_density(self, s: int) -> float:
        area = self.L.plaza_area if s == self.L.event_station else 1000.0
        return self.outside_count(s) / area

    def _note_density(self, key: tuple, value: float) -> None:
        t_prev, v_prev = self._dens.get(key, (self.now, 0.0))
        if v_prev >= self.L.rho_danger:
            self.danger_time[key] = self.danger_time.get(key, 0.0) + (self.now - t_prev)
        self._dens[key] = (self.now, value)
        if value > self.peak_density.get(key, 0.0):
            self.peak_density[key] = value

    def n_waiting(self) -> int:
        return self.n_wait

    # ------------------------------------------------------------------ main loop
    def run(self, until: float | None = None) -> Simulation:
        stop = self.t_max if until is None else min(until, self.t_max)
        while self._heap:
            t, _, kind, payload = self._heap[0]
            if t > stop:
                break
            heapq.heappop(self._heap)
            self.now = t
            getattr(self, "_on_" + kind)(*payload)
            if self.finished():
                self.t_end = self.now
                return self
        if not self._heap and not self.finished():
            self.deadlocked = True
        self.now = max(self.now, stop)
        if self.now >= self.t_max:
            self.t_end = self.t_max
        return self

    def finished(self) -> bool:
        return self.now >= self.t_onset and self._pending_arrivals == 0 and self.n_waiting() == 0

    # ------------------------------------------------------------------ passengers
    def _on_arrive(self, pid: int) -> None:
        p = self.pax.get(pid)
        if p is None:
            return
        self._pending_arrivals -= 1
        self.arrived_by_stream[p.stream] = self.arrived_by_stream.get(p.stream, 0) + 1
        self.outside[(p.origin, p.direction)].append(pid)
        self.n_wait += 1
        self._note_density(("plaza", p.origin), self.plaza_density(p.origin))
        self._kick_entry(p.origin)
        self._check_alert(p.origin, p.direction)

    def _kick_entry(self, s: int) -> None:
        if not self.entry_busy[s] and not self.entry_blocked[s] and self.outside_count(s):
            self.entry_busy[s] = True
            self._push(self.now, "entry", s)

    def _on_entry(self, s: int) -> None:
        self.entry_busy[s] = False
        qu, qd = self.outside[(s, UP)], self.outside[(s, DOWN)]
        if not qu and not qd:
            return
        if qu and (not qd or self.pax[qu[0]].t_arrive <= self.pax[qd[0]].t_arrive):
            d, q = UP, qu
        else:
            d, q = DOWN, qd
        p = self.pax[q[0]]
        cap = self.L.rho_crush * self.L.platform_area[s]
        if self.plat_units[(s, d)] + p.units > cap:
            self.entry_blocked[s] = True  # stairs and fare arrays hold the crowd outside (head-of-line)
            return
        q.popleft()
        self.platq[(s, d)].append(p.pid)
        self.t_plat[p.pid] = (self.now, self.dep_count[(s, d)])
        self.plat_units[(s, d)] += p.units
        self._note_density(("plat", s, d), self.platform_density(s, d))
        self._note_density(("plaza", s), self.plaza_density(s))
        if self.outside_count(s):
            self.entry_busy[s] = True
            self._push(self.now + 1.0 / self.L.entry_rate[s], "entry", s)

    def _place_on_platform(self, p: Passenger) -> None:
        """Riders already inside the station (backtracking, transfers at a hub) skip the entry queue."""
        k = (p.origin, p.direction)
        self.platq[k].append(p.pid)
        self.n_wait += 1
        self.t_plat[p.pid] = (self.now, self.dep_count[k])
        self.plat_units[k] += p.units
        self._note_density(("plat", *k), self.platform_density(*k))
        self._check_alert(*k)

    def _board(self, p: Passenger, vehicle: str, logged: float) -> None:
        t_plat, deps = self.t_plat.pop(p.pid, (None, None))
        k = (p.origin, p.direction)
        left = self.dep_count[k] - deps if deps is not None else 0
        self.done.append(Boarded(p.pid, p.t_arrive, self.now, p.origin, p.dest, p.klass, p.stream, vehicle,
                                 int(left), float(logged), t_plat))
        del self.pax[p.pid]
        self.n_wait -= 1

    # ------------------------------------------------------------------ alerts and decisions
    def _check_alert(self, s: int, d: int) -> None:
        k = (s, d)
        if k in self.active_calls or k in self.pending_alert:
            return
        if self.waiting_count(s, d) >= self.L.alert_levels[0]:
            self.pending_alert.add(k)
            quiet = max(0.0, self.quiet_until.get(k, 0.0) - self.now)
            self._push(self.now + self.L.alert_delay + quiet, "alert", s, d)

    def _on_alert(self, s: int, d: int) -> None:
        self.pending_alert.discard((s, d))
        n = self.waiting_count(s, d)
        if n < self.L.alert_levels[0] or (s, d) in self.active_calls:
            return
        level = sum(n >= x for x in self.L.alert_levels)
        call = Call(self._next_cid, s, d, self.now, level)
        self._next_cid += 1
        call.slots = self.candidates(s, d)
        self.active_calls[(s, d)] = call
        self.call_log.append(call)
        if self.decision_hook is not None:
            self.decision_hook(self, call)
        slot = int(self.controller.assign(self, call))
        if not 0 <= slot < N_SLOTS or call.slots[slot] is None:
            slot = 0
        self.assign(call, slot)

    def candidates(self, s: int, d: int) -> tuple:
        slots: list = [("none", -1)] + [None] * (N_SLOTS - 1)
        trains = [t for t in self.trains if t.state in ("service", "turnback") and t.express_to is None
                  and not (t.station == s and t.direction == d and self.plat_occ.get((s, d)) == t.idx)]
        trains.sort(key=lambda t: (self.loop_distance(t, s, d), t.idx))
        for j, t in zip(TRAIN_SLOTS, trains, strict=False):
            slots[j] = ("train", t.idx)
        yard = [t for t in self.trains if t.state == "yard"]
        if yard:
            slots[YARD_SLOT] = ("yard", yard[0].idx)
        buses = [b for b in self.buses if b.state in ("depot", "idle")]
        buses.sort(key=lambda b: (self.bus_eta(b, s), b.idx))
        for j, b in zip(BUS_SLOTS, buses, strict=False):
            slots[j] = ("bus", b.idx)
        return tuple(slots)

    def assign(self, call: Call, slot: int) -> None:
        call.choice = slot
        kind, i = call.slots[slot]
        s, d = call.station, call.direction
        if kind == "train":
            t = self.trains[i]
            t.express_to, t.call_cid = (s, d), call.cid
            call.vehicle = ("train", i)
        elif kind == "yard":
            self.activate_yard(i, d, express_to=(s, d), cid=call.cid)
            call.vehicle = ("train", i)
        elif kind == "bus":
            self.dispatch_bus(i, s, d)
            call.vehicle = ("bus", i)
        if self.record_trace:
            self.trace.append({"t": self.now, "ev": "assign", "slot": slot, "station": s, "dir": d})

    def _serve_call(self, s: int, d: int, vehicle: tuple) -> None:
        call = self.active_calls.get((s, d))
        if call is None:
            return
        if call.vehicle is None or call.vehicle == vehicle:
            call.t_cancel = self.now
            del self.active_calls[(s, d)]
            self.quiet_until[(s, d)] = self.now + self.L.realert_delay  # a stranded crowd is re-reported late
            self._check_alert(s, d)

    def _on_declare(self) -> None:
        self.declared = True
        self.controller.on_declaration(self)

    # ------------------------------------------------------------------ track resources
    def _free(self, res: tuple) -> bool:
        table = self.plat_occ if res[0] == "plat" else self.seg_occ
        return table.get(res[1:]) is None

    def _take(self, res: tuple, ti: int) -> None:
        (self.plat_occ if res[0] == "plat" else self.seg_occ)[res[1:]] = ti

    def _release(self, res: tuple) -> None:
        (self.plat_occ if res[0] == "plat" else self.seg_occ).pop(res[1:], None)
        for ti in self.waiters.pop(res, []):
            self._push(self.now, "retry", ti)

    def _wait_for(self, res: tuple, t: Train) -> None:
        t.blocked = True
        lst = self.waiters.setdefault(res, [])
        if t.idx not in lst:
            lst.append(t.idx)

    # ------------------------------------------------------------------ trains
    def _place_service_trains(self) -> None:
        """Spread the in-service trains around the loop by scheduled time; they leave from their platforms."""
        L = self.L
        S = L.n_stations
        order = [(s, UP) for s in range(S - 1)] + [(s, DOWN) for s in range(S - 1, 0, -1)]
        tcum, t = [], 0.0
        for s, d in order:
            tcum.append(t)
            if (s, d) == (S - 2, UP):
                t += L.seg_time(s, d, True, True) + L.t_turnback
            elif (s, d) == (1, DOWN):
                t += L.seg_time(s, d, True, True) + L.t_turnback
            else:
                t += L.seg_time(s, d, True, True) + L.t_min_dwell
        cycle = t
        used = set()
        for k in range(L.n_service):
            target = k * cycle / L.n_service
            j = min((j for j in range(len(order)) if j not in used), key=lambda j: abs(tcum[j] - target))
            used.add(j)
            s, d = order[j]
            tr = self.trains[k]
            tr.state, tr.station, tr.direction = "service", s, d
            self._take(("plat", s, d), k)
            self._push(1.0 + 0.01 * k, "close", k)
        self.cycle_time = cycle

    def stops_at(self, t: Train, s: int) -> bool:
        if t.express_to is None:
            return True
        return (s, t.direction) == t.express_to

    def _path_free(self, s: int, d: int) -> bool:
        return self._free(("seg", self.L.seg_index(s, d), d)) and self._free(("plat", s + d, d))

    def _try_depart(self, t: Train) -> None:
        L = self.L
        s, d = t.station, t.direction
        if s == L.terminal(d):
            return
        if (s, d) == ((0, UP) if d == UP else (L.n_stations - 1, DOWN)) and t.express_to is None:
            earliest = self.term_dep.get((s, d), -1e9) + L.headway
            if self.now < earliest - 1e-9:  # timetable: hold at the terminal, then board once more
                self._push(earliest, "retry", t.idx)
                t.blocked, t.topup = True, True
                return
            if t.topup and t.serving and self.platq[(s, d)]:
                t.topup = False
                self._serve(t, s)
                return
            t.topup = False
        seg, nxt = ("seg", L.seg_index(s, d), d), ("plat", s + d, d)
        for res in (seg, nxt):
            if not self._free(res):
                self._wait_for(res, t)
                return
        t.blocked = False
        self._take(seg, t.idx)
        self._take(nxt, t.idx)
        if t.serving:
            self._departed(t, s, d)
            t.serving = False
        if (s, d) in ((0, UP), (L.n_stations - 1, DOWN)):
            self.term_dep[(s, d)] = self.now
        self._release(("plat", s, d))
        s2 = s + d
        stop_end = self.stops_at(t, s2) or s2 == L.terminal(d) or not (
            s2 != L.terminal(d) and self._path_free(s2, d))
        dt = L.seg_time(s, d, start_rest=t.at_rest, stop_end=stop_end)
        t.at_rest, t.planned_stop, t.state = False, stop_end, "service"
        t.km += L.seg_len(s, d) / 1000
        self._push(self.now + dt, "reach", t.idx, s2)

    def _departed(self, t: Train, s: int, d: int) -> None:
        """A stopping train leaves (s, d): anyone still on the platform was left behind."""
        k = (s, d)
        if self.platq[k]:
            self.dep_count[k] += 1
        self.last_dep[k] = self.now

    def _on_retry(self, ti: int) -> None:
        t = self.trains[ti]
        if not t.blocked:
            return
        t.blocked = False
        if t.state == "turnback":
            self._finish_turnback(t)
        elif t.state == "crewing":
            self._enter_from_yard(t)
        elif t.state == "service":
            self._try_depart(t)

    def _on_close(self, ti: int) -> None:
        self._try_depart(self.trains[ti])

    def _on_reach(self, ti: int, s: int) -> None:
        L = self.L
        t = self.trains[ti]
        d = t.direction
        self._release(("seg", L.seg_index(s - d, d), d))
        t.station, t.serving = s, False
        if t.planned_stop:
            t.at_rest = True
        if s == L.terminal(d):
            t.at_rest = True
            self._alight_all(t, s)
            t.state = "turnback"
            self._push(self.now + L.t_turnback, "turnback", ti)
            return
        if self.stops_at(t, s):
            t.at_rest = True
            self._serve(t, s)
            return
        t.n_skips += 1
        if t.onboard[s] > 0:
            t.missed[s] = t.missed.get(s, 0.0) + t.onboard[s]
            t.onboard[s] = 0.0
        if t.at_rest:  # stopped for a blocked path, doors closed
            self._try_depart(t)
        elif self._path_free(s, d):
            self._try_depart(t)
        else:  # unplanned stop in the station
            t.at_rest = True
            self._try_depart(t)

    def _on_turnback(self, ti: int) -> None:
        self._finish_turnback(self.trains[ti])

    def _finish_turnback(self, t: Train) -> None:
        s, d2 = t.station, -t.direction
        res = ("plat", s, d2)
        if not self._free(res) and self.plat_occ.get((s, d2)) != t.idx:
            self._wait_for(res, t)
            return
        t.blocked = False
        self._take(res, t.idx)
        self._release(("plat", s, t.direction))
        t.direction, t.state, t.at_rest = d2, "service", True
        if self.stops_at(t, s):
            self._serve(t, s)
        else:
            t.n_skips += 1  # leaves the terminal without boarding
            self._try_depart(t)

    def _alight(self, t: Train, s: int) -> float:
        units = t.onboard[s]
        t.onboard[s] = 0.0
        for dest, u in t.missed.items():  # riders carried past their stop go back from here
            for _ in range(int(round(u))):
                p = self._new_passenger(s, dest, "backtrack")
                self.n_backtrack += 1
                self._place_on_platform(p)
            units += u
        t.missed = {}
        t.load = max(0.0, t.load - units)
        return units

    def _alight_all(self, t: Train, s: int) -> None:
        for dest in range(self.L.n_stations):
            if dest != s and t.onboard[dest] > 0:
                t.missed[dest] = t.missed.get(dest, 0.0) + t.onboard[dest]
                t.onboard[dest] = 0.0
        self._alight(t, s)
        t.load = 0.0

    def _serve(self, t: Train, s: int) -> None:
        L = self.L
        d = t.direction
        k = (s, d)
        t.n_stops += 1
        t.serving = True
        n_alight = self._alight(t, s)
        if t.express_to == k:
            t.express_to = None
        free = L.train_capacity * L.load_efficiency - t.load
        q = self.platq[k]
        board_s, n_board = 0.0, 0
        logged = 0.5 * (self.now - self.last_dep.get(k, self.now))
        while q:
            p = self.pax[q[0]]
            if p.units > free:
                break
            q.popleft()
            free -= p.units
            t.load += p.units
            t.onboard[p.dest] += p.units
            self.plat_units[k] -= p.units
            board_s += L.t_board * CLASS_BOARD[p.klass]
            n_board += 1
            self._board(p, f"T{t.idx}", logged)
        dwell = max(L.t_min_dwell, L.t_doors + (n_alight * L.t_alight + board_s) / L.doors)
        if L.hold_rate > 0 and len(q) >= L.alert_levels[0]:
            rng = self._rng(4, t.idx, t.n_stops)
            for _ in range(rng.poisson(L.hold_rate * min(1.0, len(q) / L.alert_levels[1]))):
                dwell += rng.uniform(*L.hold_s)
        self._note_density(("plat", s, d), self.platform_density(s, d))
        if n_board:
            self.entry_blocked[s] = False
            self._kick_entry(s)
        self._serve_call(s, d, ("train", t.idx))
        if self.record_trace:
            self.trace.append({"t": self.now, "ev": "stop", "train": t.idx, "station": s, "dir": d,
                               "board": n_board, "alight": n_alight, "load": t.load})
        self._push(self.now + dwell, "close", t.idx)

    def activate_yard(self, ti: int, d: int, express_to: tuple | None = None, cid: int | None = None) -> None:
        t = self.trains[ti]
        if t.state != "yard":
            return
        t.state, t.direction, t.station = "crewing", d, self.L.yard_station
        t.express_to, t.call_cid = express_to, cid
        self._push(self.now + self.L.t_crew, "crew", ti)

    def _on_crew(self, ti: int) -> None:
        self._enter_from_yard(self.trains[ti])

    def _enter_from_yard(self, t: Train) -> None:
        res = ("plat", self.L.yard_station, t.direction)
        if not self._free(res):
            self._wait_for(res, t)
            return
        t.blocked = False
        self._take(res, t.idx)
        t.state = "entering"
        self._push(self.now + self.L.t_yard_move, "entered", t.idx)

    def _on_entered(self, ti: int) -> None:
        t = self.trains[ti]
        t.state, t.at_rest = "service", True
        if self.stops_at(t, t.station):
            self._serve(t, t.station)
        else:
            self._try_depart(t)

    # ------------------------------------------------------------------ buses
    def bus_eta(self, b: Bus, s: int) -> float:
        crew = self.L.t_bus_crew if b.state == "depot" else 0.0
        return crew + self.L.bus_time(b.pos_m, s, b.offset)

    def dispatch_bus(self, bi: int, s: int, d: int) -> None:
        b = self.buses[bi]
        if b.state not in ("depot", "idle"):
            return
        b.shuttle = (s, d)
        b.version += 1
        if b.state == "depot":
            b.state = "crewing"
            self._push(self.now + self.L.t_bus_crew, "bus_drive", bi, b.version)
        else:
            self._on_bus_drive(bi, b.version)

    def _on_bus_drive(self, bi: int, version: int) -> None:
        b = self.buses[bi]
        if version != b.version or b.shuttle is None:
            return
        s, _ = b.shuttle
        b.state = "driving"
        self._push(self.now + self.L.bus_time(b.pos_m, s, b.offset), "bus_pickup", bi, b.version)

    def _on_bus_pickup(self, bi: int, version: int) -> None:
        L = self.L
        b = self.buses[bi]
        if version != b.version:
            return
        s, d = b.shuttle
        b.pos_m, b.offset = L.pos_m[s], 0.0
        free, board_s = L.bus_capacity, 0.0
        logged = 0.5 * (self.now - self.last_bus_dep.get(s, self.now))
        for q, on_platform in ((self.outside[(s, d)], False), (self.platq[(s, d)], True)):
            while q and free >= self.pax[q[0]].units:
                p = self.pax[q.popleft()]
                free -= p.units
                board_s += L.t_bus_board * CLASS_BOARD[p.klass]
                if on_platform:
                    self.plat_units[(s, d)] -= p.units
                b.onboard.append((p.dest, p.units))
                self.bus_boarded += 1
                self._board(p, f"B{bi}", logged)
        self.last_bus_dep[s] = self.now + board_s
        self._note_density(("plaza", s), self.plaza_density(s))
        self._note_density(("plat", s, d), self.platform_density(s, d))
        self.entry_blocked[s] = False
        self._kick_entry(s)
        self._serve_call(s, d, ("bus", bi))
        hub = L.hub(d)
        b.trips += 1
        t_drive = board_s + L.bus_time(L.pos_m[s], hub)
        self._push(self.now + t_drive, "bus_drop", bi, b.version)

    def _on_bus_drop(self, bi: int, version: int) -> None:
        L = self.L
        b = self.buses[bi]
        if version != b.version:
            return
        s, d = b.shuttle
        hub = L.hub(d)
        b.pos_m = L.pos_m[hub]
        t_alight = 0.0
        for dest, units in b.onboard:
            t_alight += L.t_bus_alight
            if (dest - hub) * d > 0:  # continues by train from the hub
                p = self._new_passenger(hub, dest, "transfer", "wheelchair" if units > 1 else "adult")
                self._place_on_platform(p)
        b.onboard = []
        if self.waiting_count(s, d) >= L.bus_capacity:
            self._push(self.now + t_alight, "bus_drive", bi, b.version)
        else:
            b.state, b.shuttle = "idle", None

    # ------------------------------------------------------------------ rollouts
    def clone(self, drop_future: bool = False) -> Simulation:
        """Copy of the live state for rollouts; boarded passengers and logs are not copied.

        Passengers are immutable and shared; queues, vehicles and calls are copied.  ``drop_future``
        omits passengers who have not arrived yet (call ``resample_future`` next)."""
        o = copy.copy(self)
        o.pax = dict(self.pax)
        o._heap = list(self._heap)
        if drop_future:
            future = {pid for pid, p in self.pax.items() if p.t_arrive > self.now}
            for pid in future:
                del o.pax[pid]
            o._heap = [e for e in o._heap if not (e[2] == "arrive" and e[3][0] in future)]
            heapq.heapify(o._heap)
            o._pending_arrivals = self._pending_arrivals - len(future)
        o.done, o.call_log, o.trace, o.decision_hook, o.record_trace = [], [], [], None, False
        o.outside = {k: deque(v) for k, v in self.outside.items()}
        o.platq = {k: deque(v) for k, v in self.platq.items()}
        for name in ("t_plat", "plat_units", "dep_count", "last_dep", "last_bus_dep", "plat_occ", "seg_occ",
                     "term_dep", "arrived_by_stream", "peak_density", "danger_time", "_dens", "quiet_until"):
            setattr(o, name, dict(getattr(self, name)))
        o.waiters = {k: list(v) for k, v in self.waiters.items()}
        o.entry_busy, o.entry_blocked = list(self.entry_busy), list(self.entry_blocked)
        o.pending_alert = set(self.pending_alert)
        o.active_calls = {k: copy.copy(c) for k, c in self.active_calls.items()}
        o.trains = copy.deepcopy(self.trains)
        o.buses = copy.deepcopy(self.buses)
        o.controller = copy.deepcopy(self.controller)
        return o

    def resample_future(self, seed: int) -> None:
        """Replace not-yet-arrived passengers with a fresh conditional draw.

        Rollout k uses the same seed for every candidate action (common random numbers)."""
        future = {pid for pid, p in self.pax.items() if p.t_arrive > self.now}
        for pid in future:
            del self.pax[pid]
        self._heap = [e for e in self._heap if not (e[2] == "arrive" and e[3][0] in future)]
        heapq.heapify(self._heap)
        self._pending_arrivals -= len(future)
        rng = np.random.default_rng([self.seed, 99, int(seed)])
        self._add_passengers(self.scenario.sample_future(rng, self.now, self.arrived_by_stream))


def waiting_cost(sim: Simulation, t0: float, t1: float, tau: float = 60.0) -> float:
    """Tail-aware waiting cost accrued in [t0, t1]: integral of (1 + w/tau) dw over each wait.

    Squared-wait style costs penalize long waits (cf. Crites & Barto 1996)."""
    cost = 0.0
    spans = [(p.t_arrive, None) for p in sim.pax.values()] + [(b.t_arrive, b.t_board) for b in sim.done]
    for ta, tb in spans:
        start = max(ta, t0)
        end = min(tb if tb is not None else t1, t1)
        if end <= start:
            continue
        w0, w1 = start - ta, end - ta
        cost += (w1 - w0) + (w1 * w1 - w0 * w0) / (2 * tau)
    return cost
