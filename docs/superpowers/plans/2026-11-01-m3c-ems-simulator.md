# M3c EMS Simulator Implementation Plan

> Steps use checkbox (`- [ ]`) syntax. The runner executes them as written.

**Goal:** Build the event-driven EMS simulator, the policy API and the practice baseline (b0). Fit the simulator's free inputs on fit days, run the anchor check once on the 68 held-out anchor days, and record the result, including its three known misfits.

**Architecture:**
- **One simulated day** is a replay of a real day's calls. Units follow fleet targets that rise with recent demand. Service times come from the calibration bundle. Common random numbers come from a per-call vector of uniforms.
- **The fit step** sets the fleet multiplier, the travel scales and the per-tier travel factors on 24 sampled fit days.
- **The anchor check** compares b0 on the anchor days with the observed anchor targets.

**Spec:** `docs/superpowers/specs/2026-11-01-m3-ems-judge-design.md` §6–§8.

**Provenance.** The reviewer built and ran this exact code in a prototype on 2026-11-01. Dylan decided as follows:
- **Round 1** (no tier factors, fixed fleet) passed 3 of 10 anchor checks.
- **Round 2,** this plan (per-tier travel factors plus a demand-elastic fleet, both fitted on fit days), passed **7 of 10**.
- **Round 3** (unit spread plus a hold-back rule) passed 3 of 10 because of a fitting bug, and is recorded as a failed attempt.

Dylan chose to freeze round 2 and report its three misfits as known limits. **Do not change the code or the tolerances to make more checks pass.**

## Global Constraints
- **Where to work:** the main checkout on `main`, with a commit and push per task (`git pull --no-rebase` first).
- **Commits:** a one-line summary, a blank line, then `Assisted-by: agent`. The name guard must pass.
- **Frozen paths:** never edit them (`judges/*/FROZEN`, `loopkit/`, `scripts/guard_paths.py`). Never touch the ledger or the holdout. Install nothing.
- **Definition of done for every task:** `.venv/bin/python -m pytest -q`, `.venv/bin/python scripts/name_guard.py` and `.venv/bin/ruff check .` all pass.
- **The anchor check runs exactly once** (Task 3). Its exit code 1 is the expected result.

---

### Task 1: Policy API, calibration lookups, simulator core, b0 (with tests first)

**Files:** create the files below with exactly this content.

- [ ] **Step 1:** create the test, then run `.venv/bin/python -m pytest judges/ems/tests/test_sim_core.py -q`. Expected: it fails with `ModuleNotFoundError: No module named 'ems.sim'` or `'ems.policy'`.

`judges/ems/tests/test_sim_core.py`:

```python
import numpy as np
import pytest


def _cal(units_by_hour=None, p_transport=0.0):
    from ems.sim.calib import Calibration

    flat = lambda v: [float(v)] * 101  # noqa: E731
    svc = {"tier1-other": {"n": 10, "tier": 1, "processing_q": flat(30), "onscene_q": flat(600), "p_transport": p_transport,
                           "transport_q": flat(300), "nontransport_close_q": flat(900)},
           "tier2-other": {"n": 5, "tier": 2, "processing_q": flat(30), "onscene_q": flat(600), "p_transport": p_transport,
                           "transport_q": flat(300), "nontransport_close_q": flat(900)},
           "tier3-other": {"n": 5, "tier": 3, "processing_q": flat(30), "onscene_q": flat(600), "p_transport": p_transport,
                           "transport_q": flat(300), "nontransport_close_q": flat(900)}}
    hours = units_by_hour or {h: 1 for h in range(24)}
    fleet = {"BRONX": {str(h): {"median": float(n)} for h, n in hours.items()}}
    offload = {"model": "base", "base": {"BRONX": {str(h): flat(1200) for h in range(24)}, "BROOKLYN": {"0": flat(1200)}}}
    inputs = {"home_weights": {"BRONX": {"z0": 1.0}}, "fleet_k": 1.0,
              "travel": {"scale": {"BRONX": {str(h): 1.0 for h in range(24)}}, "sigma": {"BRONX": 0.0}}}
    return Calibration(svc, {}, offload, fleet, ["z0", "z1"], np.array([[0.0, 600.0], [600.0, 0.0]]), inputs)


def _day(rows):  # rows: (t, zip index, tier)
    return {"t": np.array([r[0] for r in rows], dtype=float), "z": np.array([r[1] for r in rows], dtype=np.int32),
            "b": np.zeros(len(rows), dtype=np.int8), "tier": np.array([r[2] for r in rows], dtype=np.int8),
            "g": np.array([r[2] - 1 for r in rows], dtype=np.int16), "held_obs": np.zeros(len(rows), dtype=bool)}


def test_single_call_response_is_processing_plus_travel_and_within_zip_is_half_nearest():
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    cal = _cal()
    assert cal.durations[0, 0] == 300.0
    r = Simulation(cal, _day([(100.0, 1, 1)]), Practice()).run().records()
    assert r["t_scene"][0] == 100.0 + 30.0 + 600.0 and not r["held"][0]


def test_held_and_tier_priority_with_one_unit():
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    r = Simulation(_cal(), _day([(100.0, 0, 3), (200.0, 0, 3), (210.0, 0, 1)]), Practice()).run().records()
    assert not r["held"][0] and r["held"][1] and r["held"][2]
    assert r["t_assign"][2] < r["t_assign"][1]  # tier 1 is served before the earlier tier-3 call


def test_clone_continues_exactly_like_the_original():
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    day = _day([(t, t % 2, 1 + t % 3) for t in range(0, 20000, 700)])
    a = Simulation(_cal({h: 2 for h in range(24)}, p_transport=0.5), day, Practice(), seed=3)
    a.run(until=6000.0)
    b = a.clone()
    ra, rb = a.run().records(), b.run().records()
    for k in ra:
        assert np.array_equal(ra[k], rb[k], equal_nan=True), k


def test_activate_respects_the_unit_hour_budget():
    from ems.policy.api import Activate
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    sim = Simulation(_cal(), _day([(100.0, 0, 1)]), Practice())
    assert sim.budget == pytest.approx(0.10 * 24)
    sim._apply([Activate(0, 1)])
    assert sim.invalid == 1  # one 12-hour unit costs 12 unit-hours > 2.4


def test_divert_sends_a_callback_as_tier_2():
    from ems.policy.api import Divert
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    class DivertAll(Practice):
        def act(self, obs):
            return [Divert(c.i) for c in obs.queue if c.tier == 3]

    r = Simulation(_cal(), _day([(100.0, 0, 3)]), DivertAll(), params={"divert_callback_p": 1.0}).run().records()
    assert r["diverted"][0] and len(r["tier"]) == 2 and r["tier"][1] == 2 and r["parent"][1] == 0


def test_shifts_follow_the_fleet_target():
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    sim = Simulation(_cal({h: (2 if h < 12 else 1) for h in range(24)}), _day([(50000.0, 0, 1)]), Practice())
    sim.run(until=13 * 3600.0)
    assert sum(u.on_duty for u in sim.units) == 1 and len(sim.units) == 2


def test_practice_sends_the_closest_idle_unit():
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    cal = _cal({h: 2 for h in range(24)})
    cal.sim_inputs["home_weights"] = {"BRONX": {"z0": 0.5, "z1": 0.5}}
    r = Simulation(cal, _day([(100.0, 1, 1)]), Practice()).run().records()
    assert r["t_scene"][0] == 100.0 + 30.0 + 300.0  # the unit already in z1 (within-zip travel 300 s)
```

- [ ] **Step 2:** create the package files:

`judges/ems/ems/policy/__init__.py`:

```python
"""Policy API and baselines."""
```

`judges/ems/ems/policy/api.py`:

```python
"""Policy interface (spec §8): what a policy may observe and the four actions it may take."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Assign:
    call: int
    unit: int


@dataclass(frozen=True)
class Relocate:
    unit: int
    zip_index: int


@dataclass(frozen=True)
class Activate:
    borough: int
    n: int


@dataclass(frozen=True)
class Divert:
    call: int


@dataclass(frozen=True)
class QueuedCall:
    i: int
    z: int
    b: int
    tier: int
    waited_s: float


@dataclass(frozen=True)
class IdleUnit:
    id: int
    z: int
    b: int
    home: int
    moving: bool


@dataclass(frozen=True)
class Observation:
    """Only what a dispatcher has: no future calls, final severity, transport need or offload completion."""

    now: float
    hour: int
    queue: tuple[QueuedCall, ...]
    idle: tuple[IdleUnit, ...]
    busy_at_hospital: tuple[tuple[int, int, float], ...]  # (unit, borough, seconds at hospital so far)
    budget_unit_hours: float
    calls_last_hour: tuple[int, ...]  # per borough index


class Policy:
    name = "policy"

    def reset(self, sim) -> None:  # day start; sim gives read-only travel lookups via sim.travel_row(z)
        self.sim = sim

    def act(self, obs: Observation) -> list:
        return []
```

`judges/ems/ems/policy/practice.py`:

```python
"""b0, practice (spec §8): tier priority then first-come; the closest idle unit by travel time; return home."""

from __future__ import annotations

import numpy as np

from .api import Assign, Observation, Policy, Relocate


class Practice(Policy):
    name = "b0"

    def act(self, obs: Observation) -> list:
        acts = []
        idle = list(obs.idle)
        for c in sorted(obs.queue, key=lambda q: (q.tier, -q.waited_s)):
            if not idle:
                break
            row = self.sim.travel_row(c.z)
            j = int(np.argmin([row[u.z] for u in idle]))
            acts.append(Assign(c.i, idle.pop(j).id))
        for u in idle:
            if u.z != u.home and not u.moving:
                acts.append(Relocate(u.id, u.home))
        return acts
```

`judges/ems/ems/sim/__init__.py`:

```python
"""Event-driven EMS simulator."""
```

`judges/ems/ems/sim/calib.py`:

```python
"""The calibration bundle as fast lookup tables for the simulator (read-only, shared by clones)."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np

JUDGE = Path(__file__).resolve().parents[2]
CAL = JUDGE / "calibration"
BOROUGHS = ("BRONX", "BROOKLYN", "MANHATTAN", "QUEENS", "RICHMOND / STATEN ISLAND")


def inv_cdf(q, u):
    """Inverse CDF of a quantile table (evenly spaced levels) at uniform(s) u, linear between knots."""
    q = np.asarray(q, dtype=float)
    x = np.asarray(u, dtype=float) * (len(q) - 1)
    lo = np.clip(np.floor(x).astype(int), 0, len(q) - 2)
    return q[lo] + (q[lo + 1] - q[lo]) * (x - lo)


class Calibration:
    """Service tables, offload base, fleet, travel matrix, zip maps and the fitted simulator inputs."""

    def __init__(self, service: dict, groups: dict, offload: dict, fleet: dict, zips: list[str],
                 durations: np.ndarray, sim_inputs: dict):
        self.service, self.groups, self.offload, self.fleet = service, groups, offload, fleet
        self.zips = list(zips)
        self.zip_index = {z: i for i, z in enumerate(self.zips)}
        d = np.array(durations, dtype=float)
        off = np.where(np.eye(len(d), dtype=bool) | (d <= 0), np.inf, d)
        d[np.diag_indices(len(d))] = 0.5 * off.min(axis=1)  # within-zip travel: half the time to the nearest zip
        self.durations = d
        self.sim_inputs = sim_inputs
        self.tier_fallback = {}
        for g, s in sorted(service.items(), key=lambda kv: -kv[1]["n"]):
            self.tier_fallback.setdefault(int(s["tier"]), g)

    @classmethod
    def load(cls, path: Path = CAL) -> Calibration:
        path = Path(path)
        npz = np.load(path / "travel_osrm.npz")
        si = path / "sim_inputs.json"
        return cls(json.loads((path / "service.json").read_text()), json.loads((path / "call_type_groups.json").read_text()),
                   json.loads((path / "offload.json").read_text()), json.loads((path / "fleet.json").read_text()),
                   [str(z) for z in npz["zips"]], npz["durations"],
                   json.loads(si.read_text()) if si.exists() else {})

    def group_of(self, call_type: str, tier: int) -> str:
        g = self.groups.get(call_type)
        if g in self.service:
            return g
        g = f"tier{tier}-other"
        return g if g in self.service else self.tier_fallback[tier]

    def fleet_target(self, borough: str, hour: int, demand_ratio: float = 1.0) -> int:
        """Units on duty: k x median busy units at held onsets, scaled by recent demand to the fitted elasticity."""
        v = self.fleet.get(borough, {}).get(str(hour))
        k = float(self.sim_inputs.get("fleet_k", 1.0))
        eps = float(self.sim_inputs.get("fleet_elasticity", {}).get(borough, 0.0))
        return int(round(k * v["median"] * max(demand_ratio, 0.25) ** eps)) if v else 0

    def expected_calls(self, borough: str, hour: int) -> float:
        return float(self.sim_inputs.get("hourly_calls", {}).get(borough, {}).get(str(hour), 0.0))

    def tier_factor(self, tier: int) -> float:
        return float(self.sim_inputs.get("travel", {}).get("tier_factor", {}).get(str(tier), 1.0))

    def travel_scale(self, borough: str, hour: int) -> float:
        return float(self.sim_inputs.get("travel", {}).get("scale", {}).get(borough, {}).get(str(hour), 1.0))

    def travel_sigma(self, borough: str) -> float:
        return float(self.sim_inputs.get("travel", {}).get("sigma", {}).get(borough, 0.3))

    def offload_q(self, borough: str, hour: int):
        b = self.offload["base"].get(borough) or self.offload["base"]["BROOKLYN"]
        return b.get(str(hour)) or next(iter(b.values()))


def read_zips_csv(path: Path) -> dict[str, tuple[float, float]]:
    with Path(path).open() as f:
        return {r["zip"]: (float(r["lat"]), float(r["lon"])) for r in csv.DictReader(f)}
```

`judges/ems/ems/sim/core.py`:

```python
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

from ..policy.api import Activate, Assign, Divert, IdleUnit, Observation, QueuedCall, Relocate
from .calib import BOROUGHS, Calibration, inv_cdf

U_PROC, U_TRAVEL, U_TRANSPORT, U_ONSCENE, U_TTIME, U_OFFLOAD, U_CLOSE, U_DIVERT = range(8)
N_U = 8
PARAMS = {  # PROVISIONAL lever parameters; sourced from literature and frozen in M3d (spec §8)
    "activate_lag_s": 2700.0, "tour_s": 12 * 3600.0, "budget_frac": 0.10,
    "divert_triage_s": 900.0, "divert_callback_p": 0.10, "divert_callback_delay_s": 3600.0,
}


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
        self._push(c.t_call + self._svc(c, "processing_q", U_PROC), "ready", i)

    def _on_ready(self, i: int) -> None:
        c = self.calls[i]
        c.t_ready = self.now
        c.held = not any(u.status == "idle" and u.on_duty for u in self.units)
        self.queue.append(i)

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
            target = self.cal.fleet_target(b, hh, ratio)
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
        q = tuple(QueuedCall(i, self.calls[i].z, self.calls[i].b, self.calls[i].tier, self.now - self.calls[i].t_ready)
                  for i in self.queue)
        idle = tuple(IdleUnit(u.id, u.z, u.b, u.home, u.dest >= 0) for u in self.units if u.status == "idle" and u.on_duty)
        hosp = tuple((u.id, u.b, self.now - u.at_hospital_since) for u in self.units if not math.isnan(u.at_hospital_since))
        return Observation(self.now, hour, q, idle, hosp, self.budget - self.unit_hours_extra, self.recent)

    def _apply(self, actions) -> None:
        for a in actions or ():
            ok = getattr(self, f"_do_{type(a).__name__.lower()}")(a)
            self.invalid += 0 if ok else 1

    def _do_assign(self, a: Assign) -> bool:
        if a.call not in self.queue or not (0 <= a.unit < len(self.units)):
            return False
        u, c = self.units[a.unit], self.calls[a.call]
        if u.status != "idle" or not u.on_duty:
            return False
        self.queue.remove(a.call)
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
        if a.call not in self.queue or self.calls[a.call].tier != 3:
            return False
        c = self.calls[a.call]
        self.queue.remove(a.call)
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
```

- [ ] **Step 3:** run `.venv/bin/python -m pytest judges/ems/tests/test_sim_core.py -q`. Expected: **7 passed**. Then run the full checks.
- [ ] **Step 4:** commit with `EMS: simulator core, policy API and practice baseline (b0)`, then push.

### Task 2: Day tables and fit-day inputs

`judges/ems/ems/sim/trace.py`:

```python
"""Replayable day tables: one compact array set per calendar day of the calibration window (git-ignored cache)."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from ..data.windows import assert_not_holdout
from .calib import BOROUGHS, Calibration

DAYS = Path(__file__).resolve().parents[2] / "data" / "cache" / "days"


def zip_maps(df: pd.DataFrame, cal: Calibration) -> tuple[dict[str, str], dict[str, dict[str, float]]]:
    """zip -> borough (mode) and, per borough, zip -> share of its calls (zips in the travel matrix only)."""
    x = df[df["borough"].isin(BOROUGHS) & df["zipcode"].isin(cal.zip_index)]
    zb = x.groupby("zipcode")["borough"].agg(lambda s: s.mode().iloc[0]).to_dict()
    w = {}
    for b, g in x.groupby("borough"):
        c = g["zipcode"].value_counts(normalize=True)
        w[b] = {z: float(v) for z, v in c.items()}
    return zb, w


def day_table(df_day: pd.DataFrame, cal: Calibration, zip_borough: dict, home: dict) -> dict[str, np.ndarray]:
    """Arrays for one day: seconds since midnight, zip index, borough index, tier, service group, observed held."""
    top = {b: max(w, key=w.get) for b, w in home.items()}
    x = df_day.copy()
    x["bb"] = x["borough"].where(x["borough"].isin(BOROUGHS), x["zipcode"].map(zip_borough))
    x = x[x["bb"].notna()]
    x["zz"] = x["zipcode"].where(x["zipcode"].isin(cal.zip_index), x["bb"].map(top))
    x = x.sort_values("t_call", kind="stable")
    groups = sorted(cal.service)
    gi = {g: i for i, g in enumerate(groups)}
    g = [gi[cal.group_of(ct, int(tr))] for ct, tr in zip(x["initial_call_type"], x["tier"], strict=True)]
    t0 = pd.to_datetime(x["day"].astype(str))
    return {"t": (x["t_call"] - t0).dt.total_seconds().to_numpy(),
            "z": x["zz"].map(cal.zip_index).to_numpy(dtype=np.int32),
            "b": x["bb"].map({b: i for i, b in enumerate(BOROUGHS)}).to_numpy(dtype=np.int8),
            "tier": x["tier"].to_numpy(dtype=np.int8), "g": np.array(g, dtype=np.int16),
            "held_obs": x["held"].to_numpy(dtype=bool)}


def write_days(df: pd.DataFrame, cal: Calibration, zip_borough: dict, home: dict, out: Path = DAYS) -> int:
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for d, g in df.groupby("day"):
        np.savez_compressed(out / f"{d.isoformat()}.npz", **day_table(g, cal, zip_borough, home))
        n += 1
    return n


def load_day(d: date, path: Path = DAYS) -> dict[str, np.ndarray]:
    assert_not_holdout(d, d)
    with np.load(path / f"{d.isoformat()}.npz") as f:
        return {k: f[k] for k in f.files}
```

`judges/ems/ems/sim/build.py`:

```python
"""Build the replay day tables and the zip maps from the 2017-2019 calibration cache.

    python -m ems.sim.build        # writes data/cache/days/*.npz (git-ignored) and calibration/sim_inputs.json
"""

from __future__ import annotations

import json
import sys

import numpy as np
import pandas as pd

from ..calibrate.fleet import concurrency_at, held_onsets
from ..data.clean import clean
from ..data.store import load
from .calib import BOROUGHS, CAL, Calibration
from .trace import DAYS, write_days, zip_maps


def hourly_calls(fit: pd.DataFrame) -> dict:
    days = fit["day"].nunique()
    return {b: {str(h): float(n / days) for h, n in g.groupby("hour").size().items()}
            for b, g in fit[fit["borough"].isin(BOROUGHS)].groupby("borough")}


def fleet_elasticity(fit: pd.DataFrame, fleet: dict, hourly: dict) -> dict:
    """Per borough: slope of log(busy units at held onset / median for that hour) on log(trailing-3h demand ratio)."""
    out = {}
    for b in BOROUGHS:
        g = fit[fit["borough"] == b]
        ok = g["t_assign"].notna() & g["t_close"].notna() & (g["t_close"] > g["t_assign"])
        ons = held_onsets(g)
        if len(ons) < 50:
            out[b] = 0.0
            continue
        c = concurrency_at(g.loc[ok, "t_assign"].astype("int64").to_numpy(), g.loc[ok, "t_close"].astype("int64").to_numpy(),
                           ons["t_call"].astype("int64").to_numpy())
        t_all = np.sort(g["t_call"].astype("int64").to_numpy())
        t_on = ons["t_call"].astype("int64").to_numpy()
        trail = np.searchsorted(t_all, t_on, side="left") - np.searchsorted(t_all, t_on - 3 * 3600 * 10**9, side="left")
        h = ons["t_call"].dt.hour.to_numpy()
        exp3 = np.array([sum(hourly.get(b, {}).get(str((hh - k) % 24), 0.0) for k in range(1, 4)) for hh in h])
        med = np.array([fleet[b][str(hh)]["median"] for hh in h])
        m = (c > 0) & (exp3 > 0) & (trail > 0)
        x, y = np.log(trail[m] / exp3[m]), np.log(c[m] / med[m])
        out[b] = float(np.clip((x * y).sum() / (x * x).sum(), 0.0, 1.0)) if (x * x).sum() > 0 else 0.0
    return out


def tier_travel_targets(fit: pd.DataFrame) -> dict:
    return {str(int(t)): {"p50": float(g["travel_s"].median()), "p90": float(g["travel_s"].quantile(0.9))}
            for t, g in fit[fit["travel_s"].notna()].groupby("tier")}


def main() -> int:
    cal = Calibration.load()
    df = pd.concat([clean(load(f"calib-{y}")) for y in (2017, 2018, 2019)], ignore_index=True)
    anchor = json.loads((CAL / "anchor_days.json").read_text())
    excluded = {pd.Timestamp(x).date() for x in anchor["normal_2019"] + anchor["flu_2018"]}
    fit = df[~df["day"].isin(excluded)]
    zb, home = zip_maps(fit, cal)
    n = write_days(df, cal, zb, home, DAYS)
    hourly = hourly_calls(fit)
    path = CAL / "sim_inputs.json"
    inputs = json.loads(path.read_text()) if path.exists() else {}
    inputs.update({"zip_borough": zb, "home_weights": home, "hourly_calls": hourly,
                   "fleet_elasticity": fleet_elasticity(fit, cal.fleet, hourly),
                   "tier_travel_targets": tier_travel_targets(fit)})
    path.write_text(json.dumps(inputs, indent=1, sort_keys=True) + "\n")
    print(json.dumps({"days": n, "zips": len(zb), "fleet_elasticity": inputs["fleet_elasticity"],
                      "tier_travel_targets": inputs["tier_travel_targets"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 1:** run `.venv/bin/python -m ems.sim.build` (about 3.5 minutes). It writes the git-ignored `judges/ems/data/cache/days/*.npz` and `judges/ems/calibration/sim_inputs.json`. Expected:
  - `"days": 1095, "zips": 207`;
  - the fleet elasticities are Bronx 0.732, Brooklyn 0.710, Manhattan 0.682, Queens 0.798 and Staten Island 0.805;
  - the tier travel targets (p50 / p90, in seconds) are tier 1: 262 / 438, tier 2: 351 / 605 and tier 3: 466 / 1022.
- [ ] **Step 2:** run the checks, commit with `EMS: replay day tables and fit-day simulator inputs` (including `sim_inputs.json`), then push.

### Task 3: Fit, then one anchor check

`judges/ems/ems/sim/fit.py`:

```python
"""Fit the simulator's free inputs on fit days only (spec §6): the fleet multiplier and the travel scale and spread.

    python -m ems.sim.fit          # needs the day tables (python -m ems.sim.build) and writes sim_inputs.json
"""

from __future__ import annotations

import json
import math
import sys
from datetime import date
from multiprocessing import Pool
from pathlib import Path

import numpy as np

from .calib import BOROUGHS, CAL, Calibration
from .trace import DAYS

_CAL: Calibration | None = None


def _worker_init() -> None:
    global _CAL
    _CAL = Calibration.load()


def simulate_day(args) -> dict:
    """Run b0 on one day with the given simulator inputs; return records plus the observed held flags."""
    from ..policy.practice import Practice
    from .core import Simulation
    from .trace import load_day

    d, inputs, seed, days_dir = args
    cal = _CAL if _CAL is not None else Calibration.load()
    cal.sim_inputs = inputs
    day = load_day(d, Path(days_dir))
    rec = Simulation(cal, day, Practice(), seed=seed, day_key=d.toordinal()).run().records()
    rec["held_obs"] = day["held_obs"]
    rec["day"] = d.isoformat()
    return rec


def run_days(days: list[date], inputs: dict, seed: int = 0, workers: int = 24, days_dir: Path = DAYS) -> list[dict]:
    with Pool(min(workers, len(days)), initializer=_worker_init) as p:
        return p.map(simulate_day, [(d, inputs, seed, str(days_dir)) for d in days], chunksize=1)


def held_shares(results: list[dict]) -> tuple[float, float]:
    sim = np.concatenate([r["held"][: len(r["held_obs"])] for r in results]).mean()
    obs = np.concatenate([r["held_obs"] for r in results]).mean()
    return float(sim), float(obs)


def travel_quantiles(results: list[dict]) -> dict:
    out: dict = {}
    for r in results:
        h = (r["t_assign"] // 3600 % 24)
        for bi, b in enumerate(BOROUGHS):
            for hh in range(24):
                m = (r["b"] == bi) & (h == hh) & np.isfinite(r["travel_s"])
                out.setdefault(b, {}).setdefault(hh, []).append(r["travel_s"][m])
    return {b: {hh: np.concatenate(v) for hh, v in hs.items()} for b, hs in out.items()}


def sample_fit_days(fit_days: list[date], n: int = 24, seed: int = 0) -> list[date]:
    rng = np.random.default_rng(seed)
    return sorted(rng.choice(sorted(fit_days), size=n, replace=False).tolist())


def fit(days: list[date], inputs: dict, targets: dict, log=print, workers: int = 24) -> dict:
    inputs = json.loads(json.dumps(inputs))
    inputs.setdefault("travel", {"scale": {b: {str(h): 1.0 for h in range(24)} for b in BOROUGHS},
                                 "sigma": {b: 0.3 for b in BOROUGHS}})

    def bisect_k(lo: float, hi: float, iters: int) -> None:
        for _ in range(iters):
            inputs["fleet_k"] = (lo + hi) / 2
            s, o = held_shares(run_days(days, inputs, workers=workers))
            log(f"k={inputs['fleet_k']:.4f} held sim={s:.4f} obs={o:.4f}")
            lo, hi = (lo, inputs["fleet_k"]) if s < o else (inputs["fleet_k"], hi)
        inputs["fleet_k"] = (lo + hi) / 2

    bisect_k(1.0, 2.0, 8)
    for it in range(3):
        tq = travel_quantiles(run_days(days, inputs, workers=workers))
        for b in BOROUGHS:
            r50, r90 = [], []
            for hh in range(24):
                x, tgt = tq[b].get(hh, np.array([])), targets.get(b, {}).get(str(hh))
                if x.size < 30 or not tgt:
                    continue
                s50, s90 = np.percentile(x, [50, 90])
                sc = inputs["travel"]["scale"][b][str(hh)] * float(np.clip(tgt[50] / max(s50, 1.0), 0.5, 2.0))
                inputs["travel"]["scale"][b][str(hh)] = float(np.clip(sc, 0.2, 5.0))
                r50.append(math.log(tgt[90] / max(tgt[50], 1.0)))
                r90.append(math.log(s90 / max(s50, 1.0)))
            if r50:
                sg = inputs["travel"]["sigma"][b] + (np.mean(r50) - np.mean(r90)) / 1.2816
                inputs["travel"]["sigma"][b] = float(np.clip(sg, 0.05, 1.0))
        res = run_days(days, inputs, workers=workers)
        tt = inputs.get("tier_travel_targets", {})
        tf = inputs["travel"].setdefault("tier_factor", {"1": 1.0, "2": 1.0, "3": 1.0})
        for t in ("1", "2", "3"):
            x = np.concatenate([r["travel_s"][(r["tier"] == int(t)) & np.isfinite(r["travel_s"])] for r in res])
            if x.size >= 30 and t in tt:
                tf[t] = float(np.clip(tf[t] * tt[t]["p50"] / max(np.median(x), 1.0), 0.3, 3.0))
        log(f"travel iteration {it + 1}: tier factors " + json.dumps({k: round(v, 3) for k, v in tf.items()}))
        log(f"travel iteration {it + 1}: sigma " + json.dumps({b: round(v, 3) for b, v in inputs["travel"]["sigma"].items()}))
    k = inputs["fleet_k"]
    bisect_k(max(1.0, k - 0.15), k + 0.15, 6)
    return inputs


def main() -> int:
    anchor = json.loads((CAL / "anchor_days.json").read_text())
    excluded = {date.fromisoformat(x) for x in anchor["normal_2019"] + anchor["flu_2018"]}
    fit_days = [date.fromisoformat(p.stem) for p in sorted(DAYS.glob("*.npz"))]
    fit_days = [d for d in fit_days if d not in excluded]
    days = sample_fit_days(fit_days)
    inputs = json.loads((CAL / "sim_inputs.json").read_text())
    targets = json.loads((CAL / "travel_targets.json").read_text())
    out = fit(days, inputs, targets)
    out["fit_days_sample"] = [d.isoformat() for d in days]
    (CAL / "sim_inputs.json").write_text(json.dumps(out, indent=1, sort_keys=True) + "\n")
    print(json.dumps({"fleet_k": out["fleet_k"], "sigma": out["travel"]["sigma"]}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

`judges/ems/ems/sim/anchor_check.py`:

```python
"""Anchor check (spec §7): b0 on the held-out anchor days must reproduce the observed anchor targets.

    python -m ems.sim.anchor_check     # writes calibration/anchor_report.json and anchor_report.md; exit 1 on failure
"""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta

import numpy as np

from .calib import CAL
from .fit import run_days

TOL = {"p50": 0.10, "p90": 0.15, "held_abs": 0.03, "transports": 0.05, "offload": 0.10, "flu_abs": 0.05}


def metrics(results: list[dict]) -> dict:
    resp, tiers, held, tr, off = [], [], [], [], []
    for r in results:
        n = len(r["held_obs"])
        resp.append((r["t_scene"][:n] - r["t_call"][:n]) / 60)
        tiers.append(r["tier"][:n])
        held.append(r["held"][:n])
        tr.append(r["transported"][:n].sum())
        off.append(r["offload_s"][:n])
    resp, tiers, held, off = map(np.concatenate, (resp, tiers, held, off))
    out = {"tiers": {}, "held_share": float(held.mean()), "transports_per_day": float(np.mean(tr)),
           "offload_median_min": float(np.nanmedian(off) / 60)}
    for t in (1, 2, 3):
        x = resp[(tiers == t) & np.isfinite(resp)]
        out["tiers"][str(t)] = {"p50_min": float(np.percentile(x, 50)), "p90_min": float(np.percentile(x, 90))}
    return out


def compare(sim: dict, obs: dict, sim_flu: float, obs_flu: float) -> list[dict]:
    rows = []

    def rel(name, s, o, tol):
        rows.append({"check": name, "sim": s, "obs": o, "tol": f"±{tol:.0%}", "ok": abs(s - o) <= tol * abs(o)})

    def ab(name, s, o, tol):
        rows.append({"check": name, "sim": s, "obs": o, "tol": f"±{tol:.2f}", "ok": abs(s - o) <= tol})

    for t in ("1", "2", "3"):
        rel(f"tier {t} response p50 (min)", sim["tiers"][t]["p50_min"], obs["tiers"][t]["p50_min"], TOL["p50"])
        rel(f"tier {t} response p90 (min)", sim["tiers"][t]["p90_min"], obs["tiers"][t]["p90_min"], TOL["p90"])
    ab("held share", sim["held_share"], obs["held_share"], TOL["held_abs"])
    rel("transports per day", sim["transports_per_day"], obs["transports_per_day"], TOL["transports"])
    rel("offload median (min)", sim["offload_median_min"], obs["offload_median_min"], TOL["offload"])
    ab("Jan 2018 held-share increase", sim_flu, obs_flu, TOL["flu_abs"])
    return rows


def main() -> int:
    anchor = json.loads((CAL / "anchor_days.json").read_text())
    targets = json.loads((CAL / "anchor_targets.json").read_text())
    inputs = json.loads((CAL / "sim_inputs.json").read_text())
    normal = [date.fromisoformat(x) for x in anchor["normal_2019"]]
    flu = sorted(date.fromisoformat(x) for x in anchor["flu_2018"])
    base = sorted({flu[0] - timedelta(k) for k in range(1, 29)} - set(flu))
    sim_normal = metrics(run_days(normal, inputs))
    held_flu = metrics(run_days(flu, inputs))["held_share"]
    held_base = metrics(run_days(base, inputs))["held_share"]
    rows = compare(sim_normal, targets["normal"], held_flu - held_base, targets["flu"]["held_share_increase"])
    ok = all(r["ok"] for r in rows)
    (CAL / "anchor_report.json").write_text(json.dumps({"pass": ok, "rows": rows}, indent=1) + "\n")
    md = ["# EMS anchor report (b0 on held-out anchor days)", "", f"Overall: {'PASS' if ok else 'FAIL'}", "",
          "| check | sim | observed | tolerance | ok |", "|---|---|---|---|---|"]
    md += [f"| {r['check']} | {r['sim']:.3f} | {r['obs']:.3f} | {r['tol']} | {'yes' if r['ok'] else 'NO'} |" for r in rows]
    (CAL / "anchor_report.md").write_text("\n".join(md) + "\n")
    print("\n".join(md))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 1:** run `.venv/bin/python -m ems.sim.fit` (about 2 minutes on 24 cores). Expected: `fleet_k` about 1.20, and tier factors of about 0.546 / 0.712 / 0.957 for tiers 1 / 2 / 3. The run is deterministic: report the exact values.
- [ ] **Step 2:** run `.venv/bin/python -m ems.sim.anchor_check` **once**. Expected: exit 1, `Overall: FAIL`, and these 10 rows:

| check | sim | observed | ok |
|---|---|---|---|
| tier 1 response p50 (min) | 4.505 | 4.900 | yes |
| tier 1 response p90 (min) | 11.128 | 8.000 | NO |
| tier 2 response p50 (min) | 5.810 | 6.433 | yes |
| tier 2 response p90 (min) | 14.361 | 11.033 | NO |
| tier 3 response p50 (min) | 7.672 | 9.133 | NO |
| tier 3 response p90 (min) | 20.446 | 22.533 | yes |
| held share | 0.063 | 0.077 | yes |
| transports per day | 2875.689 | 2854.951 | yes |
| offload median (min) | 35.036 | 36.017 | yes |
| Jan 2018 held-share increase | 0.163 | 0.121 | yes |

  If any value differs in the third decimal, **block** and report both tables.
- [ ] **Step 3:** commit `sim_inputs.json`, `anchor_report.json` and `anchor_report.md` with `EMS: simulator fit and anchor check (7/10; three response-tail misfits)`, then push.

### Task 4: Record the known limits

- [ ] **Step 1:** append to `judges/ems/calibration/anchor_report.md` a `## Known limits (frozen 2026-11-01, Dylan)` section that says:
  - the tier-1 and tier-2 response p90 are too long in simulation (11.1 vs 8.0 min; 14.4 vs 11.0 min);
  - the tier-3 median is too short (7.7 vs 9.1 min);
  - the likely causes are more even real unit positioning and dispatchers holding units back for urgent calls;
  - round 3 tried both, failed through a fit bug, and was not retried, to keep the anchors blind.
- [ ] **Step 2:** add a dated entry to `research/journal.md` covering what was built, the 7/10 result and the limits.
- [ ] **Step 3:** run the checks, commit with `EMS: anchor known limits and journal`, push, and stop. M3d is next.
