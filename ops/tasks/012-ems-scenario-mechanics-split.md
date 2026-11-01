---
id: "012"
title: "M3d correction: frozen scenario mechanics split out of the red-loop sampler"
status: open
created: 2026-11-01
report: ops/reports/012-ems-scenario-mechanics-split.md
---
# M3d correction: scenario mechanics

**Why:** the reviewer's pre-freeze review found that `ems/evaluate.py` imported `perturb()` and `dev_days()` from `ems/scenarios/sampler.py`, the one file the red loop may edit. A red-loop edit could then change how a perturbation works or which days count as dev. This patch moves both, unchanged, into a new `ems/scenarios/core.py`, which the freeze will cover. It also pins the dev set to the 2017–2019 calibration window, and makes `build_sim` refuse any cached day outside the dev set.

**Reviewer pre-flight (2026-11-01):** applied to `cb3585c`. Ruff is clean, the full suite gives 123 passed and 1 skipped, and the dev set has 1,027 days. The benchmark reproduces task 011 exactly: `"primary": 11247.14150209779`, `METRIC ratio_b1=1.0000`.

**Steps** (main checkout, `main`, `git pull --no-rebase` first):
1. Save the patch below to a file made with `mktemp`. Run `git apply --check <file> && git apply <file>`. If `--check` fails, block. Do not hand-edit.
2. Run `.venv/bin/python -m pytest -q`, `.venv/bin/python scripts/name_guard.py` and `.venv/bin/ruff check .`. All must pass, with 123 passed and 1 skipped.
3. From `judges/ems`, run `rm -rf runs/ems-ref && ../../.venv/bin/python experiments/ar/ems_blue_bench.py --n 200`. The candidate `"primary"` must be `11247.14150209779`, followed by `METRIC ratio_b1=1.0000`. Any other value means block.
4. Commit with `EMS: frozen scenario mechanics (core.py) split from the sampler` and `Assisted-by: agent`, then push.

Do not create `judges/ems/FROZEN` and do not write ledger entries.

````diff
diff --git a/judges/ems/ems/cf.py b/judges/ems/ems/cf.py
index 39deafd..c5afe3c 100644
--- a/judges/ems/ems/cf.py
+++ b/judges/ems/ems/cf.py
@@ -92,9 +92,9 @@ class _Probe(Policy):
 
 def report(d: date, theta: dict, seed: int, policy: str, n_points: int = 20, window_s: float = 3600.0) -> dict:
     from .evaluate import make_policy
-    from .scenarios.sampler import dev_days
+    from .scenarios.core import is_dev_day
 
-    if d not in set(dev_days()):
+    if not is_dev_day(d):
         raise PermissionError(f"{d} is not a dev day")
     count = _Probe(make_policy(policy), None, window_s)
     sim = build_sim(d, theta, seed, count)
diff --git a/judges/ems/ems/evaluate.py b/judges/ems/ems/evaluate.py
index 43ab98d..9a8e31d 100644
--- a/judges/ems/ems/evaluate.py
+++ b/judges/ems/ems/evaluate.py
@@ -6,7 +6,8 @@ triage time, or, if it calls back, the time from the original call to the callba
 callback is not counted again). Claims pair L by scenario-day (loopkit.stats.paired, Holm), and must hold
 under the "equal" and "steep" weightings as well as "primary".
 
-dev:     scenario-days from ems.scenarios.sampler.dev_pool (2017-2019 fit days with bounded theta).
+dev:     scenario-days from ems.scenarios.sampler.dev_pool; build_sim refuses any cached day outside the
+         frozen dev set (ems.scenarios.core) and perturb() refuses theta outside the bounds.
 holdout: sealed pools (omicron-b primary, covid-a secondary, normal-2016, stress); require a ledger
          pre-registration and run once per pre-registration.
 """
@@ -89,11 +90,13 @@ def day_metrics(rec: dict, end_s: float, unit_hours: float) -> dict:
 
 def build_sim(d, theta: dict, seed: int, policy, params: dict | None = None, day_table: dict | None = None):
     """The Simulation for one scenario-day (perturbed day table, theta, frozen params), not yet run."""
-    from .scenarios.sampler import perturb
+    from .scenarios.core import is_dev_day, perturb
     from .sim.calib import BOROUGHS, Calibration
     from .sim.core import Simulation
     from .sim.trace import load_day
 
+    if day_table is None and not is_dev_day(d):
+        raise PermissionError(f"{d} is not a dev day")
     cal = Calibration.load()
     day = day_table if day_table is not None else load_day(d)
     zb = cal.sim_inputs.get("zip_borough", {})
diff --git a/judges/ems/ems/scenarios/core.py b/judges/ems/ems/scenarios/core.py
new file mode 100644
index 0000000..9a975de
--- /dev/null
+++ b/judges/ems/ems/scenarios/core.py
@@ -0,0 +1,78 @@
+"""Frozen scenario mechanics: the dev-day set and how theta changes a day table (spec §9).
+
+The red loop edits only `sampler.py` (which days, which theta); it cannot change what a perturbation does,
+which days count as dev, or the bounds, because this file and `bounds.py` are frozen.
+"""
+
+from __future__ import annotations
+
+import json
+from datetime import date
+from functools import lru_cache
+
+import numpy as np
+
+from ..sim.calib import CAL
+from ..sim.trace import DAYS
+from .bounds import check
+
+FIRST, LAST = date(2017, 1, 1), date(2019, 12, 31)  # the calibration window (spec §5)
+
+
+@lru_cache(maxsize=1)
+def _dev_days() -> tuple[date, ...]:
+    anchor = json.loads((CAL / "anchor_days.json").read_text())
+    excluded = {date.fromisoformat(x) for x in anchor["normal_2019"] + anchor["flu_2018"]}
+    cached = (date.fromisoformat(p.stem) for p in sorted(DAYS.glob("*.npz")))
+    return tuple(d for d in cached if FIRST <= d <= LAST and d not in excluded)
+
+
+def dev_days() -> list[date]:
+    """Cached days inside the 2017-2019 calibration window, minus the 68 anchor days."""
+    return list(_dev_days())
+
+
+def is_dev_day(d: date) -> bool:
+    return d in set(_dev_days())
+
+
+def perturb(day: dict, theta: dict, seed: int, zip_b: np.ndarray, tier_group: dict[int, int]) -> dict:
+    """Apply demand, urgent-share and concentration perturbations to a day table (offload and unavailability go to the sim)."""
+    check(theta)
+    rng = np.random.default_rng([seed, 11, len(day["t"])])
+    t, z, b, tier, g, ho = (day[k].copy() for k in ("t", "z", "b", "tier", "g", "held_obs"))
+    m = float(theta.get("demand", 1.0))
+    if m < 1.0:
+        keep = rng.random(len(t)) < m
+        t, z, b, tier, g, ho = (a[keep] for a in (t, z, b, tier, g, ho))
+    elif m > 1.0:
+        extra = rng.random(len(t)) < (m - 1.0)
+        jitter = rng.uniform(-900, 900, extra.sum())
+        t = np.concatenate([t, np.clip(t[extra] + jitter, 0, 86399)])
+        z, b, tier, g, ho = (np.concatenate([a, a[extra]]) for a in (z, b, tier, g, ho))
+    a = float(theta.get("urgent_share", 1.0))
+    urgent = tier <= 2
+    share = urgent.mean() if len(tier) else 0.0
+    if a > 1.0 and share > 0:
+        p = min(1.0, (a - 1.0) * share / max(1e-9, 1 - share))
+        flip = (~urgent) & (rng.random(len(tier)) < p)
+        tier, g = tier.copy(), g.copy()
+        tier[flip], g[flip] = 2, tier_group[2]
+    elif a < 1.0 and share > 0:
+        flip = (tier == 2) & (rng.random(len(tier)) < (1.0 - a))
+        tier, g = tier.copy(), g.copy()
+        tier[flip], g[flip] = 3, tier_group[3]
+    k, c = int(theta.get("concentration_zips", 0)), int(round(theta.get("concentration_calls", 0)))
+    if k > 0 and c > 0 and len(t):
+        zs = rng.choice(len(zip_b), size=k, replace=False)
+        ct = np.sort(rng.uniform(0, 86399, c))
+        cz = zs[rng.integers(0, k, c)]
+        src = rng.integers(0, len(t), c)
+        t = np.concatenate([t, ct])
+        z = np.concatenate([z, cz])
+        b = np.concatenate([b, zip_b[cz].astype(b.dtype)])
+        tier, g = (np.concatenate([arr, arr[src]]) for arr in (tier, g))
+        ho = np.concatenate([ho, np.zeros(c, dtype=bool)])
+    order = np.argsort(t, kind="stable")
+    return {"t": t[order], "z": z[order].astype(np.int32), "b": b[order], "tier": tier[order], "g": g[order],
+            "held_obs": ho[order]}
diff --git a/judges/ems/ems/scenarios/sampler.py b/judges/ems/ems/scenarios/sampler.py
index b7da76a..83bcdcc 100644
--- a/judges/ems/ems/scenarios/sampler.py
+++ b/judges/ems/ems/scenarios/sampler.py
@@ -1,21 +1,16 @@
-"""Scenario sampler: which dev days and which theta (the red loop may edit this file; bounds.py is frozen)."""
+"""Scenario sampler: which dev days and which theta (the red loop may edit this file only).
+
+The mechanics (dev-day set, perturbation) are frozen in `core.py`; the bounds in `bounds.py`.
+"""
 
 from __future__ import annotations
 
-import json
 from datetime import date
 
 import numpy as np
 
-from ..sim.calib import CAL
-from ..sim.trace import DAYS
 from .bounds import BOUNDS, LOAD_CAP, check
-
-
-def dev_days() -> list[date]:
-    anchor = json.loads((CAL / "anchor_days.json").read_text())
-    excluded = {date.fromisoformat(x) for x in anchor["normal_2019"] + anchor["flu_2018"]}
-    return [d for d in (date.fromisoformat(p.stem) for p in sorted(DAYS.glob("*.npz"))) if d not in excluded]
+from .core import dev_days
 
 
 def sample_theta(rng: np.random.Generator) -> dict:
@@ -34,45 +29,3 @@ def dev_pool(n: int, seed: int = 0) -> list[tuple[date, dict, int]]:
     days = dev_days()
     picks = rng.choice(len(days), size=n, replace=n > len(days))
     return [(days[i], sample_theta(rng), int(seed)) for i in picks]
-
-
-def perturb(day: dict, theta: dict, seed: int, zip_b: np.ndarray, tier_group: dict[int, int]) -> dict:
-    """Apply demand, urgent-share and concentration perturbations to a day table (offload and unavailability go to the sim)."""
-    check(theta)
-    rng = np.random.default_rng([seed, 11, len(day["t"])])
-    t, z, b, tier, g, ho = (day[k].copy() for k in ("t", "z", "b", "tier", "g", "held_obs"))
-    m = float(theta.get("demand", 1.0))
-    if m < 1.0:
-        keep = rng.random(len(t)) < m
-        t, z, b, tier, g, ho = (a[keep] for a in (t, z, b, tier, g, ho))
-    elif m > 1.0:
-        extra = rng.random(len(t)) < (m - 1.0)
-        jitter = rng.uniform(-900, 900, extra.sum())
-        t = np.concatenate([t, np.clip(t[extra] + jitter, 0, 86399)])
-        z, b, tier, g, ho = (np.concatenate([a, a[extra]]) for a in (z, b, tier, g, ho))
-    a = float(theta.get("urgent_share", 1.0))
-    urgent = tier <= 2
-    share = urgent.mean() if len(tier) else 0.0
-    if a > 1.0 and share > 0:
-        p = min(1.0, (a - 1.0) * share / max(1e-9, 1 - share))
-        flip = (~urgent) & (rng.random(len(tier)) < p)
-        tier, g = tier.copy(), g.copy()
-        tier[flip], g[flip] = 2, tier_group[2]
-    elif a < 1.0 and share > 0:
-        flip = (tier == 2) & (rng.random(len(tier)) < (1.0 - a))
-        tier, g = tier.copy(), g.copy()
-        tier[flip], g[flip] = 3, tier_group[3]
-    k, c = int(theta.get("concentration_zips", 0)), int(round(theta.get("concentration_calls", 0)))
-    if k > 0 and c > 0 and len(t):
-        zs = rng.choice(len(zip_b), size=k, replace=False)
-        ct = np.sort(rng.uniform(0, 86399, c))
-        cz = zs[rng.integers(0, k, c)]
-        src = rng.integers(0, len(t), c)
-        t = np.concatenate([t, ct])
-        z = np.concatenate([z, cz])
-        b = np.concatenate([b, zip_b[cz].astype(b.dtype)])
-        tier, g = (np.concatenate([arr, arr[src]]) for arr in (tier, g))
-        ho = np.concatenate([ho, np.zeros(c, dtype=bool)])
-    order = np.argsort(t, kind="stable")
-    return {"t": t[order], "z": z[order].astype(np.int32), "b": b[order], "tier": tier[order], "g": g[order],
-            "held_obs": ho[order]}
diff --git a/judges/ems/tests/test_scenarios.py b/judges/ems/tests/test_scenarios.py
index 9761dc7..40499e8 100644
--- a/judges/ems/tests/test_scenarios.py
+++ b/judges/ems/tests/test_scenarios.py
@@ -22,7 +22,7 @@ def test_sampler_respects_load_cap_and_is_deterministic():
 
 
 def test_perturb_scales_demand_and_adds_concentration_calls():
-    from ems.scenarios.sampler import perturb
+    from ems.scenarios.core import perturb
 
     n = 2000
     rng = np.random.default_rng(0)
@@ -37,3 +37,14 @@ def test_perturb_scales_demand_and_adds_concentration_calls():
     assert len(conc["t"]) == n + 50
     with pytest.raises(ValueError):
         perturb(day, {"demand": 2.0}, 1, zip_b, tg)
+
+
+def test_evaluator_refuses_cached_days_outside_the_dev_set():
+    from datetime import date
+
+    from ems.evaluate import build_sim
+
+    with pytest.raises(PermissionError):
+        build_sim(date(2016, 6, 1), {}, 0, "b0")  # normal-2016 holdout
+    with pytest.raises(PermissionError):
+        build_sim(date(2019, 1, 5), {}, 0, "b0")  # a 2019 anchor day
````

**Report:** the test counts, the step 3 output lines, and the commit SHA.
