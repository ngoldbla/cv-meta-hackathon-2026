"""Event-driven EMS simulator (spec §6, §8): replays one day of calls against units, shifts and hospital offload.

Common random numbers: every call carries a fixed vector of uniforms (keyed by seed and day), so two
policies see the same service times, transport decisions and travel noise for the same call.  A clone
(``copy.deepcopy`` with the calibration shared) continues exactly like the original.
"""

from __future__ import annotations

import copy
import heapq
import math
from dataclasses import dataclass, field

import numpy as np
from scipy.special import ndtri

from ..params import CENTRAL
from ..policy.api import Activate, Assign, Divert, IdleUnit, Observation, QueuedCall, Relocate
from .calib import BOROUGHS, Calibration, inv_cdf

U_PROC, U_TRAVEL, U_TRANSPORT, U_ONSCENE, U_TTIME, U_OFFLOAD, U_CLOSE, U_DIVERT = range(8)
N_U = 8
PARAMS = CENTRAL  # frozen lever parameters (ems/params.py)


@dataclass
class Call:
    i: int
    t_call: float
    z: int
    b: int
    tier: int
    g: int
    u: np.ndarray
    t_ready: float = math.nan
    t_assign: float = math.nan
    t_scene: float = math.nan
    unit: int = -1
    held: bool = False
    transported: bool = False
    offload_s: float = math.nan
    diverted: bool = False
    parent: int = -1


@dataclass
class Unit:
    id: int
    b: int
    home: int
    z: int
    status: str = "off"  # off | idle | busy
    on_duty: bool = False
    leave_when_free: bool = False
    extra_until: float = math.nan
    dest: int = -1
    at_hospital_since: float = math.nan


@dataclass(order=True)
class Event:
    t: float
    seq: int
    kind: str = field(compare=False)
    data: object = field(compare=False)


class Simulation:
    def __init__(self, cal: Calibration, day: dict, policy, seed: int = 0, day_key: int = 0,
                 theta: dict | None = None, params: dict | None = None, horizon_s: float = 86400.0):
        self.cal, self.policy = cal, policy
        self.theta = {"offload": 1.0, **(theta or {})}
        self.p = {**PARAMS, **(params or {})}
        self.horizon = horizon_s
        self.groups = sorted(cal.service)
        rng = np.random.default_rng([seed, day_key])
        n = len(day["t"])
        u = rng.random((n, N_U))
        self.calls = [Call(i, float(day["t"][i]), int(day["z"][i]), int(day["b"][i]), int(day["tier"][i]),
                           int(day["g"][i]), u[i]) for i in range(n)]
        self.extra_rng = np.random.default_rng([seed, day_key, 1])
        self.units: list[Unit] = []
        self.queue: list[int] = []
        self.events: list[Event] = []
        self.seq = 0
        self.now = 0.0
        self.invalid = 0
        self.unit_hours_extra = 0.0
        self.recent = (0,) * len(BOROUGHS)
        self.n3_seen = 0
        self.n_diverted = 0
        self.queued: set[int] = set()
        fleet_hours = sum(self.cal.fleet_target(b, h) for b in BOROUGHS for h in range(24))
        self.budget = self.p["budget_frac"] * fleet_hours
        self._make_units()
        for c in self.calls:
            self._push(c.t_call, "call", c.i)
        for h in range(25):
            self._push(h * 3600.0, "hour", h)
        policy.reset(self)

    # ---------------------------------------------------------------- setup and helpers
    def _make_units(self) -> None:
        home = self.cal.sim_inputs.get("home_weights", {})
        for bi, b in enumerate(BOROUGHS):
            n = max((self.cal.fleet_target(b, h, 2.0) for h in range(24)), default=0)
            w = home.get(b) or {self.cal.zips[0]: 1.0}
            zs = sorted(w, key=w.get, reverse=True)
            alloc = np.floor(np.array([w[z] for z in zs]) * n).astype(int)
            rem = n - alloc.sum()
            for k in np.argsort(-(np.array([w[z] for z in zs]) * n - alloc))[:rem]:
                alloc[k] += 1
            for z, a in zip(zs, alloc, strict=True):
                for _ in range(a):
                    zi = self.cal.zip_index[z]
                    self.units.append(Unit(len(self.units), bi, zi, zi))

    def _push(self, t: float, kind: str, data) -> None:
        self.seq += 1
        heapq.heappush(self.events, Event(t, self.seq, kind, data))

    def travel_row(self, z: int) -> np.ndarray:
        return self.cal.durations[:, z]

    def _travel(self, frm: int, c: Call) -> float:
        b = BOROUGHS[c.b]
        h = int(self.now // 3600) % 24
        base = self.cal.durations[frm, c.z] * self.cal.travel_scale(b, h) * self.cal.tier_factor(c.tier)
        z = ndtri(min(max(c.u[U_TRAVEL], 1e-6), 1 - 1e-6))
        return max(30.0, base * math.exp(self.cal.travel_sigma(b) * z))

    def _svc(self, c: Call, key: str, ui: int) -> float:
        return float(inv_cdf(self.cal.service[self.groups[c.g]][key], c.u[ui]))

    # ---------------------------------------------------------------- run
    def run(self, until: float | None = None) -> Simulation:
        end = until if until is not None else self.horizon + 12 * 3600.0
        while self.events and self.events[0].t <= end:
            e = heapq.heappop(self.events)
            self.now = e.t
            getattr(self, f"_on_{e.kind}")(e.data)
            self._apply(self.policy.act(self.observe()))
        return self

    def _on_call(self, i: int) -> None:
        c = self.calls[i]
        if c.tier == 3 and c.parent < 0:
            self.n3_seen += 1
        self._push(c.t_call + self._svc(c, "processing_q", U_PROC), "ready", i)

    def _on_ready(self, i: int) -> None:
        c = self.calls[i]
        c.t_ready = self.now
        c.held = not any(u.status == "idle" and u.on_duty for u in self.units)
        self.queue.append(i)
        self.queued.add(i)

    def _on_hour(self, h: int) -> None:
        hh = h % 24
        recent = [0] * len(BOROUGHS)
        for c in self.calls:
            if self.now - 3600 <= c.t_call < self.now:
                recent[c.b] += 1
        self.recent = tuple(recent)
        trail = [0] * len(BOROUGHS)
        for c in self.calls:
            if self.now - 3 * 3600 <= c.t_call < self.now:
                trail[c.b] += 1
        for bi, b in enumerate(BOROUGHS):
            exp3 = sum(self.cal.expected_calls(b, (hh - k) % 24) for k in range(1, 4))
            ratio = trail[bi] / exp3 if exp3 > 0 and h >= 3 else 1.0
            target = int(round(self.cal.fleet_target(b, hh, ratio) * (1.0 - float(self.theta.get("unavailable", 0.0)))))
            mine = [u for u in self.units if u.b == bi and math.isnan(u.extra_until)]
            on = [u for u in mine if u.on_duty and not u.leave_when_free]
            if len(on) < target:
                for u in [u for u in mine if not u.on_duty][: target - len(on)]:
                    u.on_duty, u.status, u.z = True, "idle", u.home
                for u in [u for u in mine if u.leave_when_free][: max(0, target - len(on))]:
                    u.leave_when_free = False
            elif len(on) > target:
                spare = sorted(on, key=lambda u: (u.status != "idle", u.z != u.home))
                for u in spare[: len(on) - target]:
                    if u.status == "idle":
                        u.on_duty, u.status = False, "off"
                    else:
                        u.leave_when_free = True

    def _on_free(self, uid: int) -> None:
        u = self.units[uid]
        u.at_hospital_since = math.nan
        if u.leave_when_free or (not math.isnan(u.extra_until) and self.now >= u.extra_until):
            u.on_duty, u.status, u.leave_when_free = False, "off", False
        else:
            u.status = "idle"

    def _on_hospital(self, uid: int) -> None:
        self.units[uid].at_hospital_since = self.now

    def _on_moved(self, data) -> None:
        uid, z = data
        u = self.units[uid]
        if u.dest == z:
            u.z, u.dest = z, -1

    def _on_activate(self, data) -> None:
        bi, n = data
        w = self.cal.sim_inputs.get("home_weights", {}).get(BOROUGHS[bi]) or {self.cal.zips[0]: 1.0}
        z = self.cal.zip_index[max(w, key=w.get)]
        for _ in range(n):
            self.units.append(Unit(len(self.units), bi, z, z, "idle", True, False, self.now + self.p["tour_s"]))
            self._push(self.now + self.p["tour_s"], "tour_end", len(self.units) - 1)

    def _on_tour_end(self, uid: int) -> None:
        u = self.units[uid]
        if u.status == "idle":
            u.on_duty, u.status = False, "off"

    def _on_callback(self, parent: int) -> None:
        p = self.calls[parent]
        u = self.extra_rng.random(N_U)
        g = self.groups.index(self.cal.tier_fallback[2])
        c = Call(len(self.calls), self.now, p.z, p.b, 2, g, u, parent=parent)
        self.calls.append(c)
        self._push(self.now, "call", c.i)

    # ---------------------------------------------------------------- policy interface
    def observe(self) -> Observation:
        hour = int(self.now // 3600) % 24
        now = self.now

        def queue():
            return tuple(QueuedCall(i, self.calls[i].z, self.calls[i].b, self.calls[i].tier, now - self.calls[i].t_ready)
                         for i in self.queue)

        def idle():
            return tuple(IdleUnit(u.id, u.z, u.b, u.home, u.dest >= 0) for u in self.units if u.status == "idle" and u.on_duty)

        def hosp():
            return tuple((u.id, u.b, now - u.at_hospital_since) for u in self.units if not math.isnan(u.at_hospital_since))

        divert_left = math.ceil(self.p["divert_cap"] * self.n3_seen) - self.n_diverted
        return Observation(now, hour, queue, idle, hosp, self.budget - self.unit_hours_extra, self.recent, divert_left)

    def _apply(self, actions) -> None:
        for a in actions or ():
            ok = getattr(self, f"_do_{type(a).__name__.lower()}")(a)
            self.invalid += 0 if ok else 1

    def _do_assign(self, a: Assign) -> bool:
        if a.call not in self.queued or not (0 <= a.unit < len(self.units)):
            return False
        u, c = self.units[a.unit], self.calls[a.call]
        if u.status != "idle" or not u.on_duty:
            return False
        self.queue.remove(a.call)
        self.queued.discard(a.call)
        c.t_assign, c.unit = self.now, u.id
        c.t_scene = self.now + self._travel(u.z, c)
        u.status, u.dest = "busy", -1
        if c.u[U_TRANSPORT] < self.cal.service[self.groups[c.g]]["p_transport"]:
            c.transported = True
            t_hosp = c.t_scene + self._svc(c, "onscene_q", U_ONSCENE) + self._svc(c, "transport_q", U_TTIME)
            h = int(t_hosp // 3600) % 24
            c.offload_s = float(inv_cdf(self.cal.offload_q(BOROUGHS[c.b], h), c.u[U_OFFLOAD])) * self.theta["offload"]
            self._push(t_hosp, "hospital", u.id)
            free_at = t_hosp + c.offload_s
        else:
            free_at = c.t_scene + self._svc(c, "nontransport_close_q", U_CLOSE)
        u.z = c.z
        self._push(free_at, "free", u.id)
        return True

    def _do_relocate(self, a: Relocate) -> bool:
        if not (0 <= a.unit < len(self.units)) or not (0 <= a.zip_index < len(self.cal.zips)):
            return False
        u = self.units[a.unit]
        if u.status != "idle" or u.dest == a.zip_index or u.z == a.zip_index:
            return False
        u.dest = a.zip_index
        h = int(self.now // 3600) % 24
        self._push(self.now + self.cal.durations[u.z, a.zip_index] * self.cal.travel_scale(BOROUGHS[u.b], h),
                   "moved", (u.id, a.zip_index))
        return True

    def _do_activate(self, a: Activate) -> bool:
        cost = a.n * self.p["tour_s"] / 3600.0
        if a.n <= 0 or not (0 <= a.borough < len(BOROUGHS)) or self.unit_hours_extra + cost > self.budget:
            return False
        self.unit_hours_extra += cost
        self._push(self.now + self.p["activate_lag_s"], "activate", (a.borough, a.n))
        return True

    def _do_divert(self, a: Divert) -> bool:
        if a.call not in self.queued or self.calls[a.call].tier != 3:
            return False
        if self.n_diverted + 1 > math.ceil(self.p["divert_cap"] * self.n3_seen):
            return False
        c = self.calls[a.call]
        self.queue.remove(a.call)
        self.queued.discard(a.call)
        self.n_diverted += 1
        c.diverted, c.t_assign = True, self.now
        c.t_scene = self.now + self.p["divert_triage_s"]  # resolved by secondary triage
        if c.u[U_DIVERT] < self.p["divert_callback_p"]:
            self._push(self.now + self.p["divert_callback_delay_s"], "callback", c.i)
        return True

    # ---------------------------------------------------------------- results
    def clone(self) -> Simulation:
        return copy.deepcopy(self, {id(self.cal): self.cal})

    def records(self) -> dict[str, np.ndarray]:
        cs = self.calls
        return {"t_call": np.array([c.t_call for c in cs]), "tier": np.array([c.tier for c in cs]),
                "b": np.array([c.b for c in cs]), "held": np.array([c.held for c in cs]),
                "t_scene": np.array([c.t_scene for c in cs]), "transported": np.array([c.transported for c in cs]),
                "offload_s": np.array([c.offload_s for c in cs]), "diverted": np.array([c.diverted for c in cs]),
                "parent": np.array([c.parent for c in cs]), "t_assign": np.array([c.t_assign for c in cs]),
                "travel_s": np.array([c.t_scene - c.t_assign if not c.diverted else math.nan for c in cs])}
