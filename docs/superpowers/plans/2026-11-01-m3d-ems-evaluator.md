# M3d EMS Evaluator, Scenarios, b1 and Benchmark Implementation Plan

> Steps use checkbox (`- [ ]`) syntax. The runner executes them as written.

**Goal:** Build the frozen evaluator (weighted lateness, paired claims, holdout gate), the bounded scenario
sampler, the classical baseline b1 with its foresight oracle and the regret reference, the per-decision
counterfactual reports with the sensitivity sweep, and the blue-loop benchmark. Then run the compute gate and
the sensitivity sweep once each and report the numbers.

**Architecture:**
- **A scenario-day** is a 2017-2019 dev day, a bounded perturbation theta and a seed (`ems/scenarios/`).
  `bounds.py` is frozen; the red loop may edit only `sampler.py`.
- **The evaluator** (`ems/evaluate.py`) builds the simulation for each scenario-day, runs it in a 24-process
  pool and scores weighted lateness L. Claims use the ratio of mean L with a paired bootstrap CI plus the
  Wilcoxon p-value from `loopkit.stats`, with Holm correction across the three weightings.
- **The regret reference** is, per scenario-day, the less late of b1 and the foresight oracle.
- **The benchmark** (`experiments/ar/ems_blue_bench.py`) scores the editable candidate against b1 and prints
  `METRIC ratio_b1=...` last.

**Spec:** `docs/superpowers/specs/2026-11-01-m3-ems-judge-design.md` §8-§13 (with the 2026-11-01 M3d amendment).

**Provenance.** The reviewer built, linted (ruff clean) and tested (122 passed, 1 skipped, full suite) this
exact code in a prototype on 2026-11-01, and ran every command below on the real bundle. Dylan decided:
- the lever parameters and their sensitivity ranges in `ems/params.py` (with sources);
- stress factors combine under a load cap: demand / (1 - unavailable) <= 1.413;
- b1's thresholds come from a dev grid search (`calibration/b1_params.json`); the optimum is interior.

## Global Constraints
- **Where to work:** the main checkout on `main`, with a commit and push per task (`git pull --no-rebase` first).
- **Commits:** a one-line summary, a blank line, then `Assisted-by: agent`. The name guard must pass.
- **Frozen paths:** never edit them (`judges/*/FROZEN`, `loopkit/`, `scripts/guard_paths.py`). Never touch the
  ledger or the holdout. Install nothing.
- **Definition of done for every task:** `.venv/bin/python -m pytest -q`, `.venv/bin/python scripts/name_guard.py`
  and `.venv/bin/ruff check .` all pass.
- **Run EMS commands from `judges/ems`** (the bench and `python -m ems.cf` use paths relative to it).
- **Dev days only.** Nothing in M3d reads a holdout window. `eval_holdout` is built but never called.
- **No tuning.** Do not change code, parameters, bounds or b1 thresholds to move a number. A result that
  differs from the expected range below means block, with the numbers.

---

### Task 1: Frozen parameters, bounds, scenario sampler and simulator changes

**Files:** create `ems/params.py`, `ems/scenarios/{__init__,bounds,sampler}.py`, `tests/test_scenarios.py`; patch `ems/sim/core.py` (frozen params, unavailability, divert cap and quota, O(1) queue bookkeeping, lazy observation), `ems/policy/api.py` (lazy `Observation`, `divert_left`) and `ems/policy/practice.py` (early exit).

- [ ] **Step 1:** save this patch to a temporary file made with `mktemp`, then run `git apply --check <file> && git apply <file>`. If `--check` fails, block; do not hand-edit.

````diff
diff --git a/judges/ems/ems/policy/api.py b/judges/ems/ems/policy/api.py
index 05bb12e..97ba841 100644
--- a/judges/ems/ems/policy/api.py
+++ b/judges/ems/ems/policy/api.py
@@ -46,17 +46,36 @@ class IdleUnit:
     moving: bool
 
 
-@dataclass(frozen=True)
 class Observation:
-    """Only what a dispatcher has: no future calls, final severity, transport need or offload completion."""
-
-    now: float
-    hour: int
-    queue: tuple[QueuedCall, ...]
-    idle: tuple[IdleUnit, ...]
-    busy_at_hospital: tuple[tuple[int, int, float], ...]  # (unit, borough, seconds at hospital so far)
-    budget_unit_hours: float
-    calls_last_hour: tuple[int, ...]  # per borough index
+    """Only what a dispatcher has: no future calls, final severity, transport need or offload completion.
+
+    `queue`, `idle` and `busy_at_hospital` are built on first access (read `idle` first to stop early).
+    busy_at_hospital: (unit, borough, seconds at hospital so far); calls_last_hour: per borough index;
+    divert_left: Divert actions still allowed by the divert cap.
+    """
+
+    def __init__(self, now, hour, queue_fn, idle_fn, hosp_fn, budget_unit_hours, calls_last_hour, divert_left=0):
+        self.now, self.hour, self.divert_left = now, hour, divert_left
+        self.budget_unit_hours, self.calls_last_hour = budget_unit_hours, calls_last_hour
+        self._q, self._i, self._h = queue_fn, idle_fn, hosp_fn
+
+    @property
+    def queue(self) -> tuple[QueuedCall, ...]:
+        if callable(self._q):
+            self._q = self._q()
+        return self._q
+
+    @property
+    def idle(self) -> tuple[IdleUnit, ...]:
+        if callable(self._i):
+            self._i = self._i()
+        return self._i
+
+    @property
+    def busy_at_hospital(self) -> tuple[tuple[int, int, float], ...]:
+        if callable(self._h):
+            self._h = self._h()
+        return self._h
 
 
 class Policy:
diff --git a/judges/ems/ems/policy/practice.py b/judges/ems/ems/policy/practice.py
index aa3ed62..5165c09 100644
--- a/judges/ems/ems/policy/practice.py
+++ b/judges/ems/ems/policy/practice.py
@@ -13,6 +13,8 @@ class Practice(Policy):
     def act(self, obs: Observation) -> list:
         acts = []
         idle = list(obs.idle)
+        if not idle:
+            return acts
         for c in sorted(obs.queue, key=lambda q: (q.tier, -q.waited_s)):
             if not idle:
                 break
diff --git a/judges/ems/ems/sim/core.py b/judges/ems/ems/sim/core.py
index e1b7f9c..7487137 100644
--- a/judges/ems/ems/sim/core.py
+++ b/judges/ems/ems/sim/core.py
@@ -15,15 +15,13 @@ from dataclasses import dataclass, field
 import numpy as np
 from scipy.special import ndtri
 
+from ..params import CENTRAL
 from ..policy.api import Activate, Assign, Divert, IdleUnit, Observation, QueuedCall, Relocate
 from .calib import BOROUGHS, Calibration, inv_cdf
 
 U_PROC, U_TRAVEL, U_TRANSPORT, U_ONSCENE, U_TTIME, U_OFFLOAD, U_CLOSE, U_DIVERT = range(8)
 N_U = 8
-PARAMS = {  # PROVISIONAL lever parameters; sourced from literature and frozen in M3d (spec §8)
-    "activate_lag_s": 2700.0, "tour_s": 12 * 3600.0, "budget_frac": 0.10,
-    "divert_triage_s": 900.0, "divert_callback_p": 0.10, "divert_callback_delay_s": 3600.0,
-}
+PARAMS = CENTRAL  # frozen lever parameters (ems/params.py)
 
 
 @dataclass
@@ -90,6 +88,9 @@ class Simulation:
         self.invalid = 0
         self.unit_hours_extra = 0.0
         self.recent = (0,) * len(BOROUGHS)
+        self.n3_seen = 0
+        self.n_diverted = 0
+        self.queued: set[int] = set()
         fleet_hours = sum(self.cal.fleet_target(b, h) for b in BOROUGHS for h in range(24))
         self.budget = self.p["budget_frac"] * fleet_hours
         self._make_units()
@@ -144,6 +145,8 @@ class Simulation:
 
     def _on_call(self, i: int) -> None:
         c = self.calls[i]
+        if c.tier == 3 and c.parent < 0:
+            self.n3_seen += 1
         self._push(c.t_call + self._svc(c, "processing_q", U_PROC), "ready", i)
 
     def _on_ready(self, i: int) -> None:
@@ -151,6 +154,7 @@ class Simulation:
         c.t_ready = self.now
         c.held = not any(u.status == "idle" and u.on_duty for u in self.units)
         self.queue.append(i)
+        self.queued.add(i)
 
     def _on_hour(self, h: int) -> None:
         hh = h % 24
@@ -166,7 +170,7 @@ class Simulation:
         for bi, b in enumerate(BOROUGHS):
             exp3 = sum(self.cal.expected_calls(b, (hh - k) % 24) for k in range(1, 4))
             ratio = trail[bi] / exp3 if exp3 > 0 and h >= 3 else 1.0
-            target = self.cal.fleet_target(b, hh, ratio)
+            target = int(round(self.cal.fleet_target(b, hh, ratio) * (1.0 - float(self.theta.get("unavailable", 0.0)))))
             mine = [u for u in self.units if u.b == bi and math.isnan(u.extra_until)]
             on = [u for u in mine if u.on_duty and not u.leave_when_free]
             if len(on) < target:
@@ -223,11 +227,20 @@ class Simulation:
     # ---------------------------------------------------------------- policy interface
     def observe(self) -> Observation:
         hour = int(self.now // 3600) % 24
-        q = tuple(QueuedCall(i, self.calls[i].z, self.calls[i].b, self.calls[i].tier, self.now - self.calls[i].t_ready)
-                  for i in self.queue)
-        idle = tuple(IdleUnit(u.id, u.z, u.b, u.home, u.dest >= 0) for u in self.units if u.status == "idle" and u.on_duty)
-        hosp = tuple((u.id, u.b, self.now - u.at_hospital_since) for u in self.units if not math.isnan(u.at_hospital_since))
-        return Observation(self.now, hour, q, idle, hosp, self.budget - self.unit_hours_extra, self.recent)
+        now = self.now
+
+        def queue():
+            return tuple(QueuedCall(i, self.calls[i].z, self.calls[i].b, self.calls[i].tier, now - self.calls[i].t_ready)
+                         for i in self.queue)
+
+        def idle():
+            return tuple(IdleUnit(u.id, u.z, u.b, u.home, u.dest >= 0) for u in self.units if u.status == "idle" and u.on_duty)
+
+        def hosp():
+            return tuple((u.id, u.b, now - u.at_hospital_since) for u in self.units if not math.isnan(u.at_hospital_since))
+
+        divert_left = math.ceil(self.p["divert_cap"] * self.n3_seen) - self.n_diverted
+        return Observation(now, hour, queue, idle, hosp, self.budget - self.unit_hours_extra, self.recent, divert_left)
 
     def _apply(self, actions) -> None:
         for a in actions or ():
@@ -235,12 +248,13 @@ class Simulation:
             self.invalid += 0 if ok else 1
 
     def _do_assign(self, a: Assign) -> bool:
-        if a.call not in self.queue or not (0 <= a.unit < len(self.units)):
+        if a.call not in self.queued or not (0 <= a.unit < len(self.units)):
             return False
         u, c = self.units[a.unit], self.calls[a.call]
         if u.status != "idle" or not u.on_duty:
             return False
         self.queue.remove(a.call)
+        self.queued.discard(a.call)
         c.t_assign, c.unit = self.now, u.id
         c.t_scene = self.now + self._travel(u.z, c)
         u.status, u.dest = "busy", -1
@@ -278,10 +292,14 @@ class Simulation:
         return True
 
     def _do_divert(self, a: Divert) -> bool:
-        if a.call not in self.queue or self.calls[a.call].tier != 3:
+        if a.call not in self.queued or self.calls[a.call].tier != 3:
+            return False
+        if self.n_diverted + 1 > math.ceil(self.p["divert_cap"] * self.n3_seen):
             return False
         c = self.calls[a.call]
         self.queue.remove(a.call)
+        self.queued.discard(a.call)
+        self.n_diverted += 1
         c.diverted, c.t_assign = True, self.now
         c.t_scene = self.now + self.p["divert_triage_s"]  # resolved by secondary triage
         if c.u[U_DIVERT] < self.p["divert_callback_p"]:
````

- [ ] **Step 2:** create these files with exactly this content.

`judges/ems/ems/params.py`:

````python
"""Frozen lever parameters (spec §8), approved by Dylan on 2026-11-01. Claims must hold across SENSITIVITY.

Sources:
- divert_callback_p 0.15 (range 0.075-0.175): 24-hour re-contact after telephone "hear and treat" 17.5%
  (2,508/14,349) and after video triage 7.5% (16/212); Bell et al., British Paramedic Journal 2021 (PMC8415205).
- divert_cap 0.43: DC 911 Nurse Triage Line diverted 40-43% of eligible low-acuity calls (The Lab @ DC 2022;
  JEMS, "Largest Nurse Navigation System in the Country Celebrates Five Years").
- activate_lag_s 2700 (range 1800-5400): AMR staffed 5 extra ambulances within 30 minutes of the 2014 Napa
  earthquake, and mutual aid from neighbouring counties took longer (EMS1, 2014).
- Assumptions without a source: budget_frac 0.10 (0.05-0.20), divert_triage_s 900 (600-1800),
  divert_callback_delay_s 21600 (3600-43200).
"""

CENTRAL = {"activate_lag_s": 2700.0, "tour_s": 12 * 3600.0, "budget_frac": 0.10, "divert_triage_s": 900.0,
           "divert_callback_p": 0.15, "divert_callback_delay_s": 21600.0, "divert_cap": 0.43}
SENSITIVITY = {"activate_lag_s": (1800.0, 5400.0), "budget_frac": (0.05, 0.20), "divert_triage_s": (600.0, 1800.0),
               "divert_callback_p": (0.075, 0.175), "divert_callback_delay_s": (3600.0, 43200.0)}
````

`judges/ems/ems/scenarios/__init__.py`:

````python
"""Scenario perturbations: frozen bounds and the (red-loop editable) sampler."""
````

`judges/ems/ems/scenarios/bounds.py`:

````python
"""Frozen perturbation bounds (spec §9), measured from pre-2020 data only (2005-2015 and 2017-2019; 2016 excluded).

- demand: daily calls over the trailing-28-day mean, 0.808..1.413 (max 2012-01-01; bounds_daily.csv); floor 0.9.
- urgent_share: share of severity 1-3 calls over its median, 0.765..1.153 (bounds_daily.csv).
- offload: daily borough offload median over its trailing-28-day median, max 1.151 (offload_inflation.json).
- unavailable: 1 - median(p10 / median) of busy units at held onsets, 0.25 (fleet.json).
- concentration_calls: largest single-zip daily excess over its trailing-28-day mean, 104 (2017-2019 day tables),
  spread over at most 3 zips.
- combined load: demand / (1 - unavailable) <= 1.413, the worst pre-2020 demand surge, so combinations never
  exceed a load that NYC actually met (Dylan, 2026-11-01). Draws above it are rejected, never clipped.
"""

from __future__ import annotations

BOUNDS = {"demand": (0.9, 1.413), "urgent_share": (0.765, 1.153), "offload": (1.0, 1.151), "unavailable": (0.0, 0.25),
          "concentration_calls": (0.0, 104.0), "concentration_zips": (0.0, 3.0)}
LOAD_CAP = 1.413


def check(theta: dict) -> dict:
    """Return theta unchanged, or raise ValueError for an unknown key or a value outside its bounds (never clip)."""
    for k, v in theta.items():
        if k not in BOUNDS:
            raise ValueError(f"unknown theta key {k!r}")
        lo, hi = BOUNDS[k]
        if not lo <= float(v) <= hi:
            raise ValueError(f"theta[{k!r}] = {v} outside [{lo}, {hi}]")
    load = float(theta.get("demand", 1.0)) / (1.0 - float(theta.get("unavailable", 0.0)))
    if load > LOAD_CAP:
        raise ValueError(f"combined load {load:.3f} > {LOAD_CAP}")
    return theta
````

`judges/ems/ems/scenarios/sampler.py`:

````python
"""Scenario sampler: which dev days and which theta (the red loop may edit this file; bounds.py is frozen)."""

from __future__ import annotations

import json
from datetime import date

import numpy as np

from ..sim.calib import CAL
from ..sim.trace import DAYS
from .bounds import BOUNDS, LOAD_CAP, check


def dev_days() -> list[date]:
    anchor = json.loads((CAL / "anchor_days.json").read_text())
    excluded = {date.fromisoformat(x) for x in anchor["normal_2019"] + anchor["flu_2018"]}
    return [d for d in (date.fromisoformat(p.stem) for p in sorted(DAYS.glob("*.npz"))) if d not in excluded]


def sample_theta(rng: np.random.Generator) -> dict:
    """Uniform within the bounds, rejecting draws whose combined load exceeds LOAD_CAP."""
    while True:
        t = {k: float(rng.uniform(lo, hi)) for k, (lo, hi) in BOUNDS.items() if k not in ("concentration_zips",)}
        t["concentration_zips"] = float(rng.integers(0, 4))
        if t["concentration_zips"] == 0:
            t["concentration_calls"] = 0.0
        if t["demand"] / (1.0 - t["unavailable"]) <= LOAD_CAP:
            return check(t)


def dev_pool(n: int, seed: int = 0) -> list[tuple[date, dict, int]]:
    rng = np.random.default_rng([seed, 7])
    days = dev_days()
    picks = rng.choice(len(days), size=n, replace=n > len(days))
    return [(days[i], sample_theta(rng), int(seed)) for i in picks]


def perturb(day: dict, theta: dict, seed: int, zip_b: np.ndarray, tier_group: dict[int, int]) -> dict:
    """Apply demand, urgent-share and concentration perturbations to a day table (offload and unavailability go to the sim)."""
    check(theta)
    rng = np.random.default_rng([seed, 11, len(day["t"])])
    t, z, b, tier, g, ho = (day[k].copy() for k in ("t", "z", "b", "tier", "g", "held_obs"))
    m = float(theta.get("demand", 1.0))
    if m < 1.0:
        keep = rng.random(len(t)) < m
        t, z, b, tier, g, ho = (a[keep] for a in (t, z, b, tier, g, ho))
    elif m > 1.0:
        extra = rng.random(len(t)) < (m - 1.0)
        jitter = rng.uniform(-900, 900, extra.sum())
        t = np.concatenate([t, np.clip(t[extra] + jitter, 0, 86399)])
        z, b, tier, g, ho = (np.concatenate([a, a[extra]]) for a in (z, b, tier, g, ho))
    a = float(theta.get("urgent_share", 1.0))
    urgent = tier <= 2
    share = urgent.mean() if len(tier) else 0.0
    if a > 1.0 and share > 0:
        p = min(1.0, (a - 1.0) * share / max(1e-9, 1 - share))
        flip = (~urgent) & (rng.random(len(tier)) < p)
        tier, g = tier.copy(), g.copy()
        tier[flip], g[flip] = 2, tier_group[2]
    elif a < 1.0 and share > 0:
        flip = (tier == 2) & (rng.random(len(tier)) < (1.0 - a))
        tier, g = tier.copy(), g.copy()
        tier[flip], g[flip] = 3, tier_group[3]
    k, c = int(theta.get("concentration_zips", 0)), int(round(theta.get("concentration_calls", 0)))
    if k > 0 and c > 0 and len(t):
        zs = rng.choice(len(zip_b), size=k, replace=False)
        ct = np.sort(rng.uniform(0, 86399, c))
        cz = zs[rng.integers(0, k, c)]
        src = rng.integers(0, len(t), c)
        t = np.concatenate([t, ct])
        z = np.concatenate([z, cz])
        b = np.concatenate([b, zip_b[cz].astype(b.dtype)])
        tier, g = (np.concatenate([arr, arr[src]]) for arr in (tier, g))
        ho = np.concatenate([ho, np.zeros(c, dtype=bool)])
    order = np.argsort(t, kind="stable")
    return {"t": t[order], "z": z[order].astype(np.int32), "b": b[order], "tier": tier[order], "g": g[order],
            "held_obs": ho[order]}
````

`judges/ems/tests/test_scenarios.py`:

````python
import numpy as np
import pytest


def test_bounds_reject_out_of_range_unknown_and_overload():
    from ems.scenarios.bounds import check

    assert check({"demand": 1.2, "unavailable": 0.1})
    for bad in ({"demand": 1.5}, {"surge": 1.0}, {"demand": 1.3, "unavailable": 0.2}):
        with pytest.raises(ValueError):
            check(bad)


def test_sampler_respects_load_cap_and_is_deterministic():
    from ems.scenarios.bounds import LOAD_CAP
    from ems.scenarios.sampler import sample_theta

    a = [sample_theta(np.random.default_rng(s)) for s in range(200)]
    b = [sample_theta(np.random.default_rng(s)) for s in range(200)]
    assert a == b
    assert all(t["demand"] / (1 - t["unavailable"]) <= LOAD_CAP for t in a)


def test_perturb_scales_demand_and_adds_concentration_calls():
    from ems.scenarios.sampler import perturb

    n = 2000
    rng = np.random.default_rng(0)
    day = {"t": np.sort(rng.uniform(0, 86400, n)), "z": rng.integers(0, 10, n).astype(np.int32),
           "b": np.zeros(n, np.int8), "tier": rng.choice([1, 2, 3], n).astype(np.int8),
           "g": np.zeros(n, np.int16), "held_obs": np.zeros(n, bool)}
    zip_b = np.zeros(10, np.int8)
    tg = {1: 0, 2: 1, 3: 2}
    up = perturb(day, {"demand": 1.3}, 1, zip_b, tg)
    assert 1.25 * n < len(up["t"]) < 1.35 * n and np.all(np.diff(up["t"]) >= 0)
    conc = perturb(day, {"concentration_calls": 50.0, "concentration_zips": 2.0}, 1, zip_b, tg)
    assert len(conc["t"]) == n + 50
    with pytest.raises(ValueError):
        perturb(day, {"demand": 2.0}, 1, zip_b, tg)
````

- [ ] **Step 3:** run `.venv/bin/python -m pytest -q judges/ems/tests/test_scenarios.py judges/ems/tests/test_sim_core.py` (all pass), then the full definition of done. Commit with `EMS: frozen lever parameters, scenario bounds and sampler` and push.

### Task 2: b1 (classical) and the foresight oracle

- [ ] **Step 1:** create these files with exactly this content.

`judges/ems/ems/policy/classical.py`:

````python
"""b1, classical (spec §8): b0 dispatch, hourly MEXCLP relocation (Daskin 1983), threshold surge rules.

Every hour, idle units are repositioned to greedily maximise expected covered demand within the coverage
time, with busy probability p = 1 - idle/on-duty.  When a borough's queue reaches `activate_queue`, it
requests `activate_n` extra units (at most once per hour per borough, within the budget).  While a
borough's queue is at least `divert_queue`, tier-3 calls go to secondary triage (within the divert cap).
`Oracle` adds perfect foresight to b1's levers; the regret reference is the per-day best of b1 and Oracle
(ems.evaluate.reference).
"""

from __future__ import annotations

import json
import math

import numpy as np

from ..sim.calib import BOROUGHS, CAL
from .api import Activate, Assign, Divert, Observation, Policy, Relocate

COVER_S = 480.0
DEFAULTS = {"activate_queue": 10, "activate_n": 2, "divert_queue": 10}


def load_params() -> dict:
    p = CAL / "b1_params.json"
    return {**DEFAULTS, **(json.loads(p.read_text()) if p.exists() else {})}


class Classical(Policy):
    name = "b1"

    def __init__(self, params: dict | None = None):
        self.params = {**load_params(), **(params or {})}

    def reset(self, sim) -> None:
        super().reset(sim)
        self.last_hour = -1
        self.activated: set[tuple[int, int]] = set()
        cal = sim.cal
        self.cover = cal.durations <= COVER_S
        zb = cal.sim_inputs.get("zip_borough", {})
        self.zip_b = np.array([BOROUGHS.index(zb[z]) if zb.get(z) in BOROUGHS else -1 for z in cal.zips])
        home = cal.sim_inputs.get("home_weights", {})
        self.zip_w = np.array([home.get(zb.get(z, ""), {}).get(z, 0.0) for z in cal.zips])

    def demand(self, hour: int) -> np.ndarray:
        cal = self.sim.cal
        per_b = np.array([cal.expected_calls(b, hour) for b in BOROUGHS] + [0.0])
        return self.zip_w * per_b[self.zip_b]

    def positions(self, n: int, d: np.ndarray, p: float) -> list[int]:
        cnt = np.zeros(len(d))
        out = []
        for _ in range(n):
            gain = self.cover.astype(float) @ (d * (1 - p) * p ** cnt)
            j = int(np.argmax(gain))
            out.append(j)
            cnt += self.cover[j]
        return out

    def act(self, obs: Observation) -> list:
        acts, idle, left = [], list(obs.idle), obs.divert_left
        surge = {b: sum(q.b == b for q in obs.queue) for b in range(len(BOROUGHS))}
        for c in sorted(obs.queue, key=lambda q: (q.tier, -q.waited_s)):
            if c.tier == 3 and left > 0 and surge[c.b] >= self.params["divert_queue"]:
                acts.append(Divert(c.i))
                left -= 1
                continue
            if not idle:
                continue
            row = self.sim.travel_row(c.z)
            j = int(np.argmin([row[u.z] for u in idle]))
            acts.append(Assign(c.i, idle.pop(j).id))
        for b, q in surge.items():
            if q >= self.params["activate_queue"] and obs.budget_unit_hours > 0 and (b, obs.hour) not in self.activated:
                self.activated.add((b, obs.hour))
                acts.append(Activate(b, int(self.params["activate_n"])))
        if obs.hour != self.last_hour and idle:
            self.last_hour = obs.hour
            on = sum(u.on_duty for u in self.sim.units)
            p = min(0.95, max(0.0, 1 - len(obs.idle) / max(on, 1)))
            targets = self.positions(len(idle), self.demand_now(obs), p)
            free = list(idle)
            for t in targets:
                k = int(np.argmin([self.sim.cal.durations[u.z, t] for u in free]))
                u = free.pop(k)
                if u.z != t and not u.moving:
                    acts.append(Relocate(u.id, t))
        return acts

    def demand_now(self, obs: Observation) -> np.ndarray:
        return self.demand(obs.hour)


class Oracle(Classical):
    """Antagonist (reference only, never a candidate): b1's levers with perfect foresight.

    Positions idle units on the true next-hour calls, and at each hour requests extra units for a borough
    whose true calls over the next three hours exceed the expected count by more than 10%.
    """

    name = "oracle"

    def demand_now(self, obs: Observation) -> np.ndarray:
        d = np.zeros(len(self.sim.cal.zips))
        for c in self.sim.calls:
            if obs.now <= c.t_call < obs.now + 3600:
                d[c.z] += 1
        return d

    def act(self, obs: Observation) -> list:
        acts = super().act(obs)
        if (obs.hour, "foresight") not in self.activated:
            self.activated.add((obs.hour, "foresight"))
            cal = self.sim.cal
            for bi, b in enumerate(BOROUGHS):
                true3 = sum(1 for c in self.sim.calls if c.b == bi and obs.now <= c.t_call < obs.now + 3 * 3600)
                exp3 = sum(cal.expected_calls(b, (obs.hour + k) % 24) for k in range(3))
                if exp3 > 0 and true3 > 1.1 * exp3:
                    n = int(math.ceil((true3 - exp3) / max(exp3, 1) * cal.fleet_target(b, obs.hour)))
                    acts.append(Activate(bi, max(1, min(n, 10))))
        return acts
````

`judges/ems/calibration/b1_params.json`:

````json
{"activate_n": 3, "activate_queue": 2, "divert_queue": 2}
````

`judges/ems/tests/test_classical.py`:

````python
import importlib.util
from pathlib import Path

import numpy as np

_spec = importlib.util.spec_from_file_location("ems_toy_sim", Path(__file__).with_name("test_sim_core.py"))
_toy = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_toy)
_cal, _day = _toy._cal, _toy._day


def test_b1_activates_when_queue_reaches_threshold_and_respects_budget():
    from ems.policy.api import Activate
    from ems.policy.classical import Classical
    from ems.sim.core import Simulation

    cal = _cal()
    cal.sim_inputs["hourly_calls"] = {"BRONX": {str(h): 1.0 for h in range(24)}}
    pol = Classical({"activate_queue": 2, "activate_n": 1, "divert_queue": 99})
    seen = []
    act = pol.act
    pol.act = lambda obs: seen.extend(a for a in act(obs) if isinstance(a, Activate)) or act(obs)
    sim = Simulation(cal, _day([(100.0, 1, 3), (101.0, 1, 3), (102.0, 1, 3)]), pol).run()
    assert seen and sim.unit_hours_extra <= sim.budget


def test_b1_diverts_only_within_quota():
    from ems.policy.classical import Classical
    from ems.sim.core import Simulation

    cal = _cal()
    cal.sim_inputs["hourly_calls"] = {"BRONX": {str(h): 1.0 for h in range(24)}}
    rows = [(100.0 + i, 1, 3) for i in range(10)]
    sim = Simulation(cal, _day(rows), Classical({"activate_queue": 99, "divert_queue": 2}), params={"divert_cap": 0.43})
    sim.run()
    rec = sim.records()
    assert 0 < rec["diverted"].sum() <= np.ceil(0.43 * 10) and sim.invalid == 0
````

- [ ] **Step 2:** run `.venv/bin/python -m pytest -q judges/ems/tests/test_classical.py` (all pass), then the full definition of done. Commit with `EMS: b1 classical baseline and foresight oracle` and push.

### Task 3: Evaluator and counterfactual reports

- [ ] **Step 1:** create these files with exactly this content.

`judges/ems/ems/evaluate.py`:

````python
"""Frozen EMS evaluator (spec §10). Do not edit without a new EVAL_VERSION and a ledger entry.

Per scenario-day, L = sum over calls of w_tier * max(0, R - T_tier) in minutes, where R is call creation to
the first unit on scene. Unserved calls count with R = end of run - creation. A diverted call counts R = the
triage time, or, if it calls back, the time from the original call to the callback's unit on scene (the
callback is not counted again). Claims pair L by scenario-day (loopkit.stats.paired, Holm), and must hold
under the "equal" and "steep" weightings as well as "primary".

dev:     scenario-days from ems.scenarios.sampler.dev_pool (2017-2019 fit days with bounded theta).
holdout: sealed pools (omicron-b primary, covid-a secondary, normal-2016, stress); require a ledger
         pre-registration and run once per pre-registration.
"""

from __future__ import annotations

import importlib
import importlib.util
import json
import math
from multiprocessing import Pool
from pathlib import Path

import numpy as np

from loopkit.ledger import Ledger, file_sha256
from loopkit.stats import holm, paired

from .params import CENTRAL
from .tiers import TARGET_MIN

EVAL_VERSION = "ems-1.0"
WEIGHTINGS = {"primary": {1: 8.0, 2: 3.0, 3: 1.0}, "equal": {1: 1.0, 2: 1.0, 3: 1.0}, "steep": {1: 20.0, 2: 5.0, 3: 1.0}}
HOLDOUT_POOLS = ("omicron-b", "covid-a", "normal-2016", "stress")


def make_policy(name: str):
    if name == "b0":
        from .policy.practice import Practice

        return Practice()
    if name == "b1":
        from .policy.classical import Classical

        return Classical()
    if name == "oracle":
        from .policy.classical import Oracle

        return Oracle()
    if name.startswith("file:"):
        path, cls = name[5:].rsplit(":", 1)
        spec = importlib.util.spec_from_file_location(f"ems_candidate_{abs(hash(path))}", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return getattr(mod, cls)()
    if name.startswith("py:"):
        _, mod, cls = name.split(":", 2)
        return getattr(importlib.import_module(mod), cls)()
    raise ValueError(f"unknown policy {name!r}")


def response_s(rec: dict, end_s: float) -> np.ndarray:
    """R per original call (callbacks merged into their parent), unserved calls censored at end_s."""
    r = np.where(np.isfinite(rec["t_scene"]), rec["t_scene"], end_s) - rec["t_call"]
    for i in np.nonzero(rec["parent"] >= 0)[0]:
        p = int(rec["parent"][i])
        r[p] = (rec["t_scene"][i] if np.isfinite(rec["t_scene"][i]) else end_s) - rec["t_call"][p]
    return r


def lateness(rec: dict, weights: dict, end_s: float) -> float:
    r = response_s(rec, end_s)
    keep = rec["parent"] < 0
    w = np.array([weights[int(t)] for t in rec["tier"][keep]])
    tgt = np.array([TARGET_MIN[int(t)] * 60.0 for t in rec["tier"][keep]])
    return float((w * np.maximum(0.0, r[keep] - tgt)).sum() / 60.0)


def day_metrics(rec: dict, end_s: float, unit_hours: float) -> dict:
    r = response_s(rec, end_s) / 60.0
    keep = rec["parent"] < 0
    t1 = r[keep & (rec["tier"] == 1)]
    out = {k: lateness(rec, w, end_s) for k, w in WEIGHTINGS.items()}
    out.update({"tier1_p90_min": float(np.percentile(t1, 90)) if t1.size else math.nan,
                "held_share": float(rec["held"][keep].mean()), "unit_hours_extra": float(unit_hours),
                "divert_share": float(rec["diverted"][keep].mean()), "callbacks": int((rec["parent"] >= 0).sum()),
                "n_calls": int(keep.sum())})
    return out


def build_sim(d, theta: dict, seed: int, policy, params: dict | None = None, day_table: dict | None = None):
    """The Simulation for one scenario-day (perturbed day table, theta, frozen params), not yet run."""
    from .scenarios.sampler import perturb
    from .sim.calib import BOROUGHS, Calibration
    from .sim.core import Simulation
    from .sim.trace import load_day

    cal = Calibration.load()
    day = day_table if day_table is not None else load_day(d)
    zb = cal.sim_inputs.get("zip_borough", {})
    zip_b = np.array([BOROUGHS.index(zb[z]) if zb.get(z) in BOROUGHS else 0 for z in cal.zips])
    groups = sorted(cal.service)
    tier_group = {t: groups.index(cal.tier_fallback[t]) for t in (1, 2, 3)}
    day = perturb(day, theta, seed, zip_b, tier_group)
    return Simulation(cal, day, make_policy(policy) if isinstance(policy, str) else policy, seed=seed,
                      day_key=d.toordinal(),
                      theta={"offload": theta.get("offload", 1.0), "unavailable": theta.get("unavailable", 0.0)},
                      params={**CENTRAL, **(params or {})})


def end_s(sim) -> float:
    return sim.horizon + 12 * 3600.0


def run_scenario(args) -> dict:
    d, theta, seed, policy_name, params, day_table = args
    sim = build_sim(d, theta, seed, policy_name, params, day_table)
    sim.run()
    m = day_metrics(sim.records(), end_s(sim), sim.unit_hours_extra)
    m.update({"day": d.isoformat(), "seed": seed, "policy": policy_name, "invalid": sim.invalid})
    return m


def run_pool(scenarios: list, policies: list[str], workers: int = 24, params: dict | None = None,
             tables: list | None = None) -> dict:
    jobs = [(d, th, s, p, params, (tables[i] if tables else None)) for p in policies
            for i, (d, th, s) in enumerate(scenarios)]
    with Pool(min(workers, len(jobs))) as pool:
        rows = pool.map(run_scenario, jobs, chunksize=1)
    out = {p: [] for p in policies}
    for r in rows:
        out[r["policy"]].append(r)
    return out


def ratio_of_means(xa, xb, n_boot: int = 2000, seed: int = 0) -> tuple[float, list[float]]:
    """mean(L_a) / mean(L_b) with a paired bootstrap 95% CI (robust to days where L_b = 0)."""
    xa, xb = np.asarray(xa, dtype=float), np.asarray(xb, dtype=float)
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(xa), (n_boot, len(xa)))
    boots = xa[idx].mean(1) / np.maximum(xb[idx].mean(1), 1e-9)
    return float(xa.mean() / max(xb.mean(), 1e-9)), [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))]


def compare(rows: dict, a: str, b: str) -> list[dict]:
    """Paired tests of a vs b per weighting. The claim statistic is `ratio` (< 1 means a is less late)."""
    tests = []
    for w in WEIGHTINGS:
        xa, xb = [r[w] for r in rows[a]], [r[w] for r in rows[b]]
        ratio, ci = ratio_of_means(xa, xb)
        tests.append({"a": a, "b": b, "weighting": w, **paired(xa, xb), "ratio": ratio, "ratio_ci95": ci})
    adj = holm([t["wilcoxon_p"] for t in tests])
    for t, p in zip(tests, adj, strict=True):
        t["holm_p"] = p
    return tests


def reference(rows: dict, keys=("b1", "oracle")) -> list[dict]:
    """The regret reference (spec §7): per scenario-day, the less late of b1 and the foresight oracle, per weighting.

    The oracle alone is not a lower bound (hour-ahead true calls are sparse, and early activations spend the
    budget), so regret = L - L_ref is never negative against b1.
    """
    out = []
    for day_rows in zip(*(rows[k] for k in keys), strict=True):
        best = {w: min(r[w] for r in day_rows) for w in WEIGHTINGS}
        out.append({**day_rows[0], **best, "policy": "ref"})
    return out


def summarize(rows: dict) -> dict:
    keys = ("primary", "equal", "steep", "tier1_p90_min", "held_share", "unit_hours_extra", "divert_share", "callbacks")
    return {p: {k: float(np.nanmean([r[k] for r in rs])) for k in keys} for p, rs in rows.items()}


def eval_dev(policies: list[str], n: int = 200, seed: int = 0, workers: int = 24, params: dict | None = None,
             out: str | None = None) -> dict:
    from .scenarios.sampler import dev_pool

    rows = run_pool(dev_pool(n, seed), policies, workers, params)
    report = {"split": "dev", "eval_version": EVAL_VERSION, "evaluator_sha256": file_sha256(__file__), "n": n,
              "seed": seed, "params": {**CENTRAL, **(params or {})}, "summary": summarize(rows), "rows": rows}
    if out:
        Path(out).parent.mkdir(parents=True, exist_ok=True)
        Path(out).write_text(json.dumps(report, indent=1))
    return report


def eval_holdout(policies: list[str], prereg_id: str, comparisons: list[tuple], pool: str, scenarios: list,
                 tables: list, ledger: Ledger | None = None, workers: int = 24) -> dict:
    """Confirmatory run on a sealed pool; the caller (scripts/confirm) supplies the sealed day tables."""
    if pool not in HOLDOUT_POOLS:
        raise ValueError(f"unknown holdout pool {pool!r}")
    ledger = ledger or Ledger()
    if not ledger.verify():
        raise RuntimeError("ledger chain broken")
    if ledger.prereg(prereg_id) is None:
        raise PermissionError(f"no pre-registration {prereg_id} in the ledger")
    if ledger.holdout_used(prereg_id):
        raise PermissionError(f"holdout already used for {prereg_id}")
    rows = run_pool(scenarios, policies, workers, None, tables)
    tests = [t for a, b in comparisons for t in compare(rows, a, b)]
    report = {"split": "holdout", "pool": pool, "prereg": prereg_id, "eval_version": EVAL_VERSION,
              "evaluator_sha256": file_sha256(__file__), "summary": summarize(rows), "tests": tests}
    import hashlib

    blob = json.dumps(report, sort_keys=True, default=str)
    ledger.append("holdout_eval", {"prereg": prereg_id, "pool": pool,
                                   "report_sha256": hashlib.sha256(blob.encode()).hexdigest(), "tests": tests})
    return report
````

`judges/ems/ems/cf.py`:

````python
"""Counterfactual per-decision reports and sensitivity sweeps (spec §11). Dev days only, never for claims.

Decision points are the policy's Assign (while other calls wait), Activate and Divert actions. At most `n_points`
are sampled per day. At each one the run is cloned before the actions apply, and each alternative to that one
action is played for `window_s` under the same random draws, with the policy under test acting afterwards:
the next 3 nearest idle units, holding the call, diverting it (tier 3), and activating 0 or 1 extra unit.
delta = L_window(alternative) - L_window(chosen), primary weights, calls created before the window end and
censored at it; a negative delta is a better alternative.
"""

from __future__ import annotations

import json
import sys
from dataclasses import replace
from datetime import date

import numpy as np

from .evaluate import WEIGHTINGS, build_sim, end_s, lateness, response_s
from .params import CENTRAL, SENSITIVITY
from .policy.api import Activate, Assign, Divert, Policy
from .tiers import TARGET_MIN


def _window_l(sim, t_end: float) -> float:
    """Primary-weighted lateness of original calls created before t_end, responses capped at t_end."""
    rec = sim.records()
    r = np.minimum(response_s(rec, t_end), t_end - rec["t_call"])
    keep = (rec["parent"] < 0) & (rec["t_call"] < t_end)
    w = np.array([WEIGHTINGS["primary"][int(x)] for x in rec["tier"][keep]])
    tgt = np.array([TARGET_MIN[int(x)] * 60.0 for x in rec["tier"][keep]])
    return float((w * np.maximum(0.0, r[keep] - tgt)).sum() / 60.0)


def alternatives(sim, obs, actions: list, k: int) -> list[tuple[str, list]]:
    a, rest = actions[k], actions[:k] + actions[k + 1:]
    out = []
    if isinstance(a, Assign):
        c = sim.calls[a.call]
        row = sim.travel_row(c.z)
        taken = {x.unit for x in actions if isinstance(x, Assign)}
        others = sorted((u for u in obs.idle if u.id not in taken), key=lambda u: row[u.z])[:3]
        out += [(f"unit {u.id}", rest[:k] + [replace(a, unit=u.id)] + rest[k:]) for u in others]
        out.append(("hold", rest))
        if c.tier == 3:
            out.append(("divert", rest[:k] + [Divert(a.call)] + rest[k:]))
        out.append(("activate 1", actions + [Activate(c.b, 1)]))
    elif isinstance(a, Activate):
        out.append(("activate 0", rest))
        if a.n != 1:
            out.append(("activate 1", rest[:k] + [replace(a, n=1)] + rest[k:]))
    elif isinstance(a, Divert):
        out.append(("hold", rest))
    return out


class _Probe(Policy):
    """Wraps the policy under test; counts decision points, and at the chosen ones scores the alternatives."""

    def __init__(self, base: Policy, chosen: set[int] | None, window_s: float):
        self.base, self.chosen, self.window_s = base, chosen, window_s
        self.n, self.points = 0, []

    def reset(self, sim) -> None:
        super().reset(sim)
        self.base.reset(sim)

    def act(self, obs):
        acts = list(self.base.act(obs) or [])
        for k, a in enumerate(acts):
            if isinstance(a, (Activate, Divert)) or (isinstance(a, Assign) and len(obs.queue) > 1):
                if self.chosen is not None and self.n in self.chosen:
                    self.points.append(self._score(obs, acts, k))
                self.n += 1
        return acts

    def _branch(self, actions: list) -> float:
        cl = self.sim.clone()
        cl.policy = cl.policy.base
        cl._apply(actions)
        t_end = self.sim.now + self.window_s
        return _window_l(cl.run(until=t_end), t_end)

    def _score(self, obs, acts: list, k: int) -> dict:
        chosen = self._branch(acts)
        alts = [{"alt": name, "delta": self._branch(var) - chosen} for name, var in alternatives(self.sim, obs, acts, k)]
        best = min(alts, key=lambda x: x["delta"]) if alts else None
        return {"t": self.sim.now, "queue": len(obs.queue), "idle": len(obs.idle), "chosen": repr(acts[k]),
                "best_alt": best["alt"] if best else None, "delta": best["delta"] if best else 0.0, "alts": alts}


def report(d: date, theta: dict, seed: int, policy: str, n_points: int = 20, window_s: float = 3600.0) -> dict:
    from .evaluate import make_policy
    from .scenarios.sampler import dev_days

    if d not in set(dev_days()):
        raise PermissionError(f"{d} is not a dev day")
    count = _Probe(make_policy(policy), None, window_s)
    sim = build_sim(d, theta, seed, count)
    sim.run()
    factual = lateness(sim.records(), WEIGHTINGS["primary"], end_s(sim))
    rng = np.random.default_rng([seed, d.toordinal(), 13])
    chosen = set(rng.choice(count.n, size=min(n_points, count.n), replace=False).tolist()) if count.n else set()
    probe = _Probe(make_policy(policy), chosen, window_s)
    build_sim(d, theta, seed, probe).run()
    pts = sorted(probe.points, key=lambda p: p["delta"])
    return {"day": d.isoformat(), "theta": theta, "seed": seed, "policy": policy, "factual_primary": factual,
            "decision_points": count.n, "sampled": len(pts), "highest_regret": pts}


def sensitivity(policies=("b0", "b1"), n: int = 48, seed: int = 0, workers: int = 24) -> dict:
    """Ratio of mean L (policies[1] / policies[0]) at the central values and at each end of every SENSITIVITY range."""
    from .evaluate import compare, run_pool
    from .scenarios.sampler import dev_pool

    pool = dev_pool(n, seed)
    out = {}
    for name, val in [("central", None)] + [(f"{k}={v}", (k, v)) for k, rng in SENSITIVITY.items() for v in rng]:
        params = {**CENTRAL, **({val[0]: val[1]} if val else {})}
        rows = run_pool(pool, list(policies), workers, params)
        out[name] = {t["weighting"]: [round(t["ratio"], 4), [round(x, 4) for x in t["ratio_ci95"]]]
                     for t in compare(rows, policies[1], policies[0])}
    return out


def main(argv: list[str]) -> None:
    """python -m ems.cf <policy> <yyyy-mm-dd> [seed] | python -m ems.cf --sensitivity [n]"""
    if argv[0] == "--sensitivity":
        print(json.dumps(sensitivity(n=int(argv[1]) if len(argv) > 1 else 48), indent=1))
        return
    print(json.dumps(report(date.fromisoformat(argv[1]), {}, int(argv[2]) if len(argv) > 2 else 0, argv[0]), indent=1))


if __name__ == "__main__":
    main(sys.argv[1:])
````

`judges/ems/tests/test_evaluate.py`:

````python
from datetime import date

import numpy as np
import pytest


def _rec(t_call, t_scene, tier, parent=None, diverted=None):
    n = len(t_call)
    return {"t_call": np.array(t_call, float), "t_scene": np.array(t_scene, float), "tier": np.array(tier),
            "parent": np.array(parent if parent is not None else [-1] * n),
            "diverted": np.array(diverted if diverted is not None else [False] * n),
            "held": np.zeros(n, bool)}


def test_lateness_is_weighted_minutes_over_target():
    from ems.evaluate import WEIGHTINGS, lateness

    # tier 1 at 20 min (5 late x 8), tier 2 at 30 min (on time), tier 3 at 130 min (10 late x 1)
    rec = _rec([0, 0, 0], [1200, 1800, 7800], [1, 2, 3])
    assert lateness(rec, WEIGHTINGS["primary"], 1e9) == pytest.approx(50.0)
    assert lateness(rec, WEIGHTINGS["equal"], 1e9) == pytest.approx(15.0)


def test_unserved_calls_are_censored_at_end_of_run():
    from ems.evaluate import WEIGHTINGS, lateness

    rec = _rec([0], [np.inf], [1])
    assert lateness(rec, WEIGHTINGS["equal"], 3600.0) == pytest.approx(45.0)


def test_callback_replaces_its_parent_and_is_not_counted_twice():
    from ems.evaluate import WEIGHTINGS, lateness

    # diverted tier-3 call resolved at 15 min, called back; callback unit on scene at 200 min after the original call
    rec = _rec([0, 21600], [900, 12000], [3, 2], parent=[-1, 0], diverted=[True, False])
    assert lateness(rec, WEIGHTINGS["equal"], 1e9) == pytest.approx(200.0 - 120.0)


def test_ratio_of_means_survives_zero_baseline_days():
    from ems.evaluate import ratio_of_means

    r, ci = ratio_of_means([1.0, 0.0, 2.0, 1.0], [2.0, 0.0, 4.0, 2.0])
    assert r == pytest.approx(0.5) and ci[0] <= 0.5 <= ci[1]


def test_eval_holdout_requires_preregistration(tmp_path):
    from ems.evaluate import eval_holdout
    from loopkit.ledger import Ledger

    led = Ledger(tmp_path / "ledger.jsonl")
    with pytest.raises(PermissionError):
        eval_holdout(["b0"], "prereg-x", [], "omicron-b", [], [], ledger=led)
    with pytest.raises(ValueError):
        eval_holdout(["b0"], "prereg-x", [], "2019", [], [], ledger=led)


def test_counterfactual_refuses_non_dev_days():
    from ems.cf import report

    with pytest.raises(PermissionError):
        report(date(2022, 1, 1), {}, 0, "b0")


def test_reference_is_per_day_best_of_b1_and_oracle():
    from ems.evaluate import WEIGHTINGS, reference

    row = lambda v: {w: v for w in WEIGHTINGS}  # noqa: E731
    ref = reference({"b1": [row(5.0), row(1.0)], "oracle": [row(3.0), row(2.0)]})
    assert [r["primary"] for r in ref] == [3.0, 1.0]
````

- [ ] **Step 2:** run `.venv/bin/python -m pytest -q judges/ems/tests/test_evaluate.py` (all pass), then the full definition of done. Commit with `EMS: frozen evaluator and counterfactual reports` and push.

### Task 4: Benchmark, compute gate, sensitivity sweep, report

- [ ] **Step 1:** create these files with exactly this content.

`judges/ems/experiments/ar/ems_candidate.py`:

````python
"""Blue-loop candidate policy (the autoresearch loop edits this file only). Starts as b1."""

from __future__ import annotations

from ems.policy.classical import Classical


class Candidate(Classical):
    name = "candidate"
````

`judges/ems/experiments/ar/ems_blue_bench.py`:

````python
"""Autoresearch benchmark for the EMS judge, blue role (dev only).

Scores the candidate policy on n dev scenario-days through the frozen evaluator and prints the line the
autoresearch loop parses, last (lower is better; 1.0 = as late as b1):

    METRIC ratio_b1=0.9312

    python experiments/ar/ems_blue_bench.py --n 200

b1 and oracle reference rows are cached per (n, seed, evaluator hash) in runs/ems-ref/.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

CANDIDATE = "experiments/ar/ems_candidate.py"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidate", default=CANDIDATE)
    ap.add_argument("--cls", default="Candidate")
    ap.add_argument("--n", type=int, default=200)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--workers", type=int, default=24)
    ap.add_argument("--out", default="runs/ar-blue-ems")
    a = ap.parse_args(argv)
    import ems.evaluate as ev  # frozen evaluator: import only
    from ems.scenarios.sampler import dev_pool
    from loopkit.ledger import file_sha256

    t0 = time.time()
    pool = dev_pool(a.n, a.seed)
    ref = Path("runs/ems-ref") / f"n{a.n}-s{a.seed}-{file_sha256(ev.__file__)[:12]}.json"
    if ref.exists():
        rows = json.loads(ref.read_text())
    else:
        rows = ev.run_pool(pool, ["b1", "oracle"], a.workers)
        ref.parent.mkdir(parents=True, exist_ok=True)
        ref.write_text(json.dumps(rows))
    cand = f"file:{Path(a.candidate).resolve()}:{a.cls}"
    rows["candidate"] = ev.run_pool(pool, [cand], a.workers)[cand]
    tests = ev.compare(rows, "candidate", "b1")
    summary = ev.summarize(rows)
    o = ev.summarize({"ref": ev.reference(rows)})["ref"]["primary"]
    b, c = (summary[k]["primary"] for k in ("b1", "candidate"))
    run = Path(a.out) / time.strftime("%Y%m%d-%H%M%S")
    run.mkdir(parents=True, exist_ok=True)
    (run / "dev_eval.json").write_text(json.dumps({"summary": summary, "tests": tests, "rows": rows["candidate"]}))
    print(json.dumps({"run": str(run), "seconds": round(time.time() - t0, 1), "summary": summary["candidate"],
                      "regret_closed": (b - c) / max(b - o, 1e-9),
                      "ratio_by_weighting": {t["weighting"]: round(t["ratio"], 4) for t in tests}}))
    print(f"METRIC ratio_b1={tests[0]['ratio']:.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
````

- [ ] **Step 2:** run the checks, commit with `EMS: blue-loop benchmark and candidate`, and push.

- [ ] **Step 3: compute gate (pre-registered, spec §12).** From `judges/ems`, with no `runs/ems-ref/` present:

```bash
rm -rf runs/ems-ref
/usr/bin/time -f "wall %e s" ../../.venv/bin/python experiments/ar/ems_blue_bench.py --n 200   # cold: refs + candidate
/usr/bin/time -f "wall %e s" ../../.venv/bin/python experiments/ar/ems_blue_bench.py --n 200   # warm: candidate only
```

Expected (reviewer, dylan-pc, 24 cores): cold about 91 s and warm about 31 s, both well under the 600 s gate. Both
print `METRIC ratio_b1=1.0000` and `"regret_closed": 0.0` (the candidate is b1, and common random numbers make the
pairing exact); the candidate's `"primary"` is 11247.14. The gate fails only if a wall time exceeds 600 s.

- [ ] **Step 4: references.** From `judges/ems`:

```bash
../../.venv/bin/python -c "
import glob, json
import ems.evaluate as ev
rows = json.load(open(glob.glob('runs/ems-ref/*.json')[0]))
s = ev.summarize({**rows, 'ref': ev.reference(rows)})
for p in s: print(p, round(s[p]['primary'], 1), round(s[p]['tier1_p90_min'], 2))
print('oracle < b1 on', sum(o['primary'] < b['primary'] for o, b in zip(rows['oracle'], rows['b1'])), 'of 200')"
```

Expected: `b1 11247.1 16.13`, `oracle 13279.x 16.45`, `ref 10759.x 16.13`, `oracle < b1 on 71 of 200`.

- [ ] **Step 5: one counterfactual report.** `../../.venv/bin/python -m ems.cf b1 2018-02-12 0 > runs/cf-b1-2018-02-12.json`.
Expected: about 15 s, `factual_primary` 1603.57, `decision_points` 22, `sampled` 20 (a quiet day: deltas near 0).

- [ ] **Step 6: sensitivity sweep.** `../../.venv/bin/python -m ems.cf --sensitivity 48 > runs/sensitivity-48.json` (about
20 min). Expected primary ratios (b1 / b0): central 0.0413; activate_lag_s 1800 → 0.0392, 5400 → 0.0407; budget_frac
0.05 → 0.0622, 0.2 → 0.0247; divert_triage_s 600 and 1800 → 0.0413; divert_callback_p 0.075 → 0.0248, 0.175 → 0.0466;
divert_callback_delay_s 3600 → 0.0091, 43200 → 0.0824. Every CI upper end is below 0.1.

- [ ] **Step 7: report.** Write `judges/ems/calibration/m3d_report.md` with these sections, filled from the outputs above
(numbers as printed, no rounding beyond the output):
  - `## Compute gate` (both wall times, pass or fail);
  - `## References on 200 dev days` (the step 4 lines);
  - `## Counterfactual report` (the step 5 counts and the top 3 `best_alt` / `delta`);
  - `## Sensitivity` (a table: setting, then primary, equal and steep ratio with CI);
  - `## Known limits`, which states:
    - the foresight oracle beats b1 on only 71 of 200 days; the per-day reference is about 4% below b1, so regret headroom against the reference is small;
    - triage time has no effect, since a diverted call with no callback is never late;
    - callback delay is the most sensitive setting;
    - activation alternatives in counterfactual reports have only 15 min of effect inside the 60-min window.

- [ ] **Step 8:** add a dated entry to `research/journal.md` (what was built, the gate result, the known limits). Run the
checks, commit with `EMS: M3d compute gate, sensitivity and report`, push, and stop. The freeze is a separate
maintainer step after Dylan's review: do not create `judges/ems/FROZEN` and do not write ledger entries.

Do not commit anything under `runs/` (it is ignored).
