"""Classical baselines for answering platform-crowding alerts.

* ``Timetable``       - no extra action: trains keep running and stopping everywhere.
* ``NextTrain``       - send the nearest train express to the alert.
* ``ExpressRule``     - current practice, made reactive: at the event station, put a yard train in, else
                        send the nearest train express; elsewhere keep the timetable.
* ``RollingHorizon``  - for each candidate, estimate when vehicles reach the alert and how much room they
                        have, then roll a fluid queue forward and pick the least waiting (skip-stop after
                        Gao et al. 2016; bus shuttles after Bish 2011).  ``omniscient=True`` reads the true
                        queue and riders' destinations (a reference, not a candidate).
* ``ForecastStaging`` - on the emergency declaration, stage yard trains and buses at the event station for
                        the forecast crowd; alerts go to the wrapped controller.
"""

from __future__ import annotations

import math

from ..forecast.baseline import ScheduleForecaster
from .base import (
    BUS_SLOTS,
    DOWN,
    TRAIN_SLOTS,
    UP,
    YARD_SLOT,
    Controller,
    estimated_queue,
    train_eta,
    yard_eta,
)


class Timetable(Controller):
    name = "timetable"

    def assign(self, sim, call) -> int:
        return 0


class NextTrain(Controller):
    name = "next_train"

    def assign(self, sim, call) -> int:
        return 1 if call.slots[1] is not None else 0


class ExpressRule(Controller):
    name = "express_rule"

    def assign(self, sim, call) -> int:
        if call.station != sim.L.event_station:
            return 0
        if call.slots[YARD_SLOT] is not None:
            return YARD_SLOT
        return 1 if call.slots[1] is not None else 0


def fluid_cost(q0: float, rate: float, events: list, horizon: float) -> float:
    """Person-seconds of waiting at one platform over ``horizon`` under a fluid queue: arrivals at
    ``rate``, each event (eta, capacity) removes up to its capacity; the queue left at the end is
    charged half the horizon again."""
    t_prev, q, cost = 0.0, q0, 0.0
    for eta, cap in sorted(events):
        if eta > horizon:
            break
        dt = max(0.0, eta - t_prev)
        cost += q * dt + 0.5 * rate * dt * dt
        q = max(0.0, q + rate * dt - cap)
        t_prev = max(t_prev, eta)
    dt = horizon - t_prev
    cost += q * dt + 0.5 * rate * dt * dt
    q += rate * dt
    return cost + q * horizon * 0.5


class RollingHorizon(Controller):
    def __init__(self, omniscient: bool = False, horizon: float = 900.0, forecaster=None, sep: float = 90.0):
        self.omniscient = omniscient
        self.horizon = horizon
        self.fc = forecaster or ScheduleForecaster()
        self.sep = sep
        self.name = "rolling_horizon_omniscient" if omniscient else "rolling_horizon"

    # --- estimates ---------------------------------------------------------------------------
    def _capacity(self, sim) -> float:
        L = sim.L
        return L.train_capacity * (L.load_efficiency if self.omniscient else 1.0)

    def _kept(self, sim, t, s: int, d: int) -> float:
        """Riders still aboard when train t reaches (s, d)."""
        if self.omniscient:
            if t.direction != d:
                return 0.0
            return float(sum(u for dest, u in enumerate(t.onboard) if (dest - s) * d > 0))
        return 0.5 * t.load if t.direction == d else 0.0

    def _pickups(self, sim, t, s: int, d: int) -> float:
        L = sim.L
        cur, n = t.station, 0.0
        if t.direction != d:
            cur = L.terminal(d) if d == DOWN else 0
        while cur != s and 0 <= cur < L.n_stations:
            if self.omniscient:
                n += sim.waiting_count(cur, d)
            else:
                n += self.fc.background_rate(sim, cur) * 0.5 * L.headway
            cur += d
        return n

    def _skipped(self, sim, t, s: int, d: int) -> float:
        """People hurt by sending t express to (s, d): riders carried past and passengers passed by."""
        L = sim.L
        riders = t.load * (0.5 if not self.omniscient else 1.0)
        if self.omniscient:
            riders = float(sum(u for dest, u in enumerate(t.onboard) if (dest - t.station) * t.direction > 0
                               and ((dest - s) * t.direction < 0 or t.direction != d)))
        passed, cur, cd = 0.0, t.station, t.direction
        for _ in range(2 * L.n_stations):
            nxt = cur + cd
            if nxt < 0 or nxt >= L.n_stations:
                cd = -cd
                continue
            cur = nxt
            if (cur, cd) == (s, d):
                break
            passed += sim.waiting_count(cur, cd) if self.omniscient else \
                self.fc.background_rate(sim, cur) * 0.5 * L.headway
        return riders + passed

    def service_events(self, sim, s: int, d: int, express: int | None = None) -> list:
        cap = self._capacity(sim)
        trains = [t for t in sim.trains if t.state in ("service", "turnback", "crewing", "entering")
                  and (t.express_to is None or t.express_to == (s, d) or t.idx == express)]
        rows = []
        for t in trains:
            fast = t.idx == express or t.express_to == (s, d)
            eta = train_eta(sim, t, s, d, express=fast)
            if eta > self.horizon or math.isinf(eta):
                continue
            room = cap - self._kept(sim, t, s, d) - (0.0 if fast else self._pickups(sim, t, s, d))
            rows.append([sim.loop_distance(t, s, d), eta, max(0.0, room)])
        rows.sort()
        out, last = [], -1e9
        for _, eta, room in rows:  # no overtaking: each train at least ``sep`` behind the one ahead
            eta = max(eta, last + self.sep)
            last = eta
            out.append((eta, room))
        return out

    def slot_cost(self, sim, call, slot: int, q0: float, rate: float, base: list) -> float:
        L = sim.L
        s, d = call.station, call.direction
        kind, i = call.slots[slot]
        harm = 0.0
        events = list(base)
        if kind == "train":
            events = self.service_events(sim, s, d, express=i)
            harm = self._skipped(sim, sim.trains[i], s, d) * L.headway
        elif kind == "yard":
            events.append((yard_eta(sim, s, d), self._capacity(sim)))
        elif kind == "bus":
            b = sim.buses[i]
            eta = sim.bus_eta(b, s)
            cycle = 2 * L.bus_time(L.pos_m[s], L.hub(d)) + L.bus_capacity * L.t_bus_board
            while eta <= self.horizon:
                events.append((eta, L.bus_capacity))
                eta += cycle
        return fluid_cost(q0, rate, events, self.horizon) + harm

    def assign(self, sim, call) -> int:
        s, d = call.station, call.direction
        q0 = estimated_queue(sim, call, self.omniscient)
        rate = self.fc.rate(sim, s, d, sim.now, self.horizon)
        base = self.service_events(sim, s, d)
        costs = {j: self.slot_cost(sim, call, j, q0, rate, base) for j, c in enumerate(call.slots) if c is not None}
        return min(costs, key=lambda j: (costs[j], j))


class ForecastStaging(Controller):
    """Stage yard trains and shuttle buses at the event station when the emergency is declared."""

    def __init__(self, base: Controller | None = None, forecaster=None, bus_share: float = 0.5):
        self.base = base or RollingHorizon()
        self.fc = forecaster or ScheduleForecaster()
        self.bus_share = bus_share
        self.name = f"staging({self.base.name})"
        self.omniscient = getattr(self.base, "omniscient", False)

    def reset(self, sim) -> None:
        self.base.reset(sim)

    def assign(self, sim, call) -> int:
        return self.base.assign(sim, call)

    def on_declaration(self, sim) -> None:
        L = sim.L
        ev = L.event_station
        total = self.fc.evac_total(sim)
        yard = [t.idx for t in sim.trains if t.state == "yard"]
        plan = []
        for d in (UP, DOWN):
            need = math.ceil(total * self.fc.dir_share(d) / L.train_capacity - 0.5)
            plan += [d] * max(0, need)
        for ti, d in zip(yard, plan, strict=False):
            sim.activate_yard(ti, d, express_to=(ev, d))
        buses = [b.idx for b in sim.buses if b.state in ("depot", "idle")]
        for bi in buses[: int(round(self.bus_share * len(buses)))]:
            sim.dispatch_bus(bi, ev, UP)


__all__ = ["Timetable", "NextTrain", "ExpressRule", "RollingHorizon", "ForecastStaging", "fluid_cost",
           "TRAIN_SLOTS", "BUS_SLOTS"]
