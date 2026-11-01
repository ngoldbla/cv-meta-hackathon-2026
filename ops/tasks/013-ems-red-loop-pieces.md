---
id: "013"
title: "M4: red-loop generator, red bench, stress-pool builder, worktree cache link"
status: open
created: 2026-11-01
report: ops/reports/013-ems-red-loop-pieces.md
---
# M4: red-loop pieces

**What:**
- `experiments/ar/ems_red_sampler.py`, the file the red loop edits. It starts as the nominal sampler.
- `experiments/ar/ems_red_bench.py`, which reports b1's regret against the foresight oracle on 200 dev days.
- `scripts/stress_pool.py`, which applies the red generator to the 2016 dates without reading any 2016 calls.
- Tests for all three.
- A fix so `scripts/ar_worktree.sh` links the git-ignored EMS day-table cache into new loop worktrees.

**Reviewer pre-flight (2026-11-01):**
- Applied to `19817fc`: ruff is clean and the full suite gives 128 passed, 1 skipped.
- `ar_worktree.sh` was tested in a throwaway clone: the new worktree saw all 1,095 day tables.
- The red bench on the unchanged generator printed `METRIC regret_b1=500.25` in about 62 s.

**Steps** (main checkout, `main`, `git pull --no-rebase` first):
1. Save the patch below to a file made with `mktemp`, then run `git apply --check <file> && git apply <file>`. If `--check` fails, block. Do not hand-edit.
2. Run `.venv/bin/python -m pytest -q`, `.venv/bin/python scripts/name_guard.py` and `.venv/bin/ruff check .`. All must pass, with 128 passed and 1 skipped.
3. From `judges/ems`, run `../../.venv/bin/python experiments/ar/ems_red_bench.py --n 200`. The last line must be `METRIC regret_b1=500.25`. Any other value means block.
4. Commit with `EMS: red-loop generator, red bench and stress-pool builder` and `Assisted-by: agent`, then push.

Do not write ledger entries. Do not run `scripts/stress_pool.py` against the real manifests folder: the stress pool is built in the M4 maintainer step.

````diff
diff --git a/judges/ems/experiments/ar/ems_red_bench.py b/judges/ems/experiments/ar/ems_red_bench.py
new file mode 100644
index 0000000..ff14d72
--- /dev/null
+++ b/judges/ems/experiments/ar/ems_red_bench.py
@@ -0,0 +1,75 @@
+"""Autoresearch benchmark for the EMS judge, red role (dev only).
+
+Scores the red generator by b1's regret on n dev scenario-days: the mean over days of
+max(0, L_b1 - L_oracle), primary weights, in weighted late minutes. Higher is better for red. Raw lateness is
+not the objective, because it rewards unwinnable scenarios (program spec §5.3). Printed last:
+
+    METRIC regret_b1=1234.56
+
+    python experiments/ar/ems_red_bench.py --n 200
+"""
+
+from __future__ import annotations
+
+import argparse
+import importlib.util
+import json
+import time
+from pathlib import Path
+
+import numpy as np
+
+GENERATOR = "experiments/ar/ems_red_sampler.py"
+
+
+def load(path: str):
+    spec = importlib.util.spec_from_file_location("ems_red_generator", path)
+    mod = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(mod)
+    return mod
+
+
+def pool(gen, n: int, seed: int) -> list:
+    from ems.scenarios.bounds import check
+    from ems.scenarios.core import dev_days, is_dev_day
+
+    rng = np.random.default_rng([seed, 17])
+    days = gen.pick_days(rng, dev_days(), n)
+    out = []
+    for d in days:
+        if not is_dev_day(d):
+            raise PermissionError(f"{d} is not a dev day")
+        out.append((d, check(gen.sample_theta(rng, d)), int(seed)))
+    return out
+
+
+def main(argv: list[str] | None = None) -> int:
+    ap = argparse.ArgumentParser()
+    ap.add_argument("--generator", default=GENERATOR)
+    ap.add_argument("--n", type=int, default=200)
+    ap.add_argument("--seed", type=int, default=0)
+    ap.add_argument("--workers", type=int, default=24)
+    ap.add_argument("--out", default="runs/ar-red-ems")
+    a = ap.parse_args(argv)
+    import ems.evaluate as ev  # frozen evaluator: import only
+
+    t0 = time.time()
+    scen = pool(load(a.generator), a.n, a.seed)
+    rows = ev.run_pool(scen, ["b1", "oracle"], a.workers)
+    reg = np.maximum(0.0, np.array([b["primary"] for b in rows["b1"]]) - np.array([o["primary"] for o in rows["oracle"]]))
+    summary = ev.summarize(rows)
+    run = Path(a.out) / time.strftime("%Y%m%d-%H%M%S")
+    run.mkdir(parents=True, exist_ok=True)
+    (run / "red_eval.json").write_text(json.dumps({"summary": summary, "regret": reg.tolist(),
+                                                   "scenarios": [(d.isoformat(), th) for d, th, _ in scen]}))
+    thetas = [th for _, th, _ in scen]
+    print(json.dumps({"run": str(run), "seconds": round(time.time() - t0, 1), "b1_primary": summary["b1"]["primary"],
+                      "oracle_primary": summary["oracle"]["primary"], "days_with_regret": int((reg > 0).sum()),
+                      "mean_demand": float(np.mean([t.get("demand", 1.0) for t in thetas])),
+                      "mean_unavailable": float(np.mean([t.get("unavailable", 0.0) for t in thetas]))}))
+    print(f"METRIC regret_b1={reg.mean():.2f}")
+    return 0
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
diff --git a/judges/ems/experiments/ar/ems_red_sampler.py b/judges/ems/experiments/ar/ems_red_sampler.py
new file mode 100644
index 0000000..1be9fcf
--- /dev/null
+++ b/judges/ems/experiments/ar/ems_red_sampler.py
@@ -0,0 +1,23 @@
+"""Red-loop scenario generator (the red autoresearch loop edits this file only). Starts as the nominal sampler.
+
+Interface (fixed by the frozen red bench and stress-pool builder):
+- sample_theta(rng, d) -> theta for calendar date d. It may use only d itself (weekday, month, holiday), never the
+  day's calls, because the same function is applied to sealed holdout dates. theta must pass ems.scenarios.bounds.check.
+- pick_days(rng, days, n) -> n dates from `days` (dev only; never used for holdout pools).
+"""
+
+from __future__ import annotations
+
+from datetime import date
+
+import numpy as np
+
+from ems.scenarios.sampler import sample_theta as nominal_theta
+
+
+def sample_theta(rng: np.random.Generator, d: date) -> dict:
+    return nominal_theta(rng)
+
+
+def pick_days(rng: np.random.Generator, days: list[date], n: int) -> list[date]:
+    return [days[i] for i in rng.choice(len(days), size=n, replace=n > len(days))]
diff --git a/judges/ems/scripts/stress_pool.py b/judges/ems/scripts/stress_pool.py
new file mode 100644
index 0000000..5537631
--- /dev/null
+++ b/judges/ems/scripts/stress_pool.py
@@ -0,0 +1,53 @@
+"""Build the sealed stress pool from the red generator (maintainer step at M4; frozen once used).
+
+Applies the red generator's sample_theta to every calendar date of 2016 (the sealed normal-2016 window). It reads
+no call data: only the dates. Writes data/manifests/stress-pool.json with the generator's SHA-256 and every theta,
+for a dataset_release ledger entry. The pool's seeds are fixed in the pre-registrations.
+
+    python scripts/stress_pool.py --generator experiments/ar/ems_red_sampler.py
+"""
+
+from __future__ import annotations
+
+import argparse
+import importlib.util
+import json
+from datetime import date, timedelta
+from pathlib import Path
+
+import numpy as np
+
+from ems.scenarios.bounds import check
+from loopkit.ledger import file_sha256
+
+OUT = Path(__file__).resolve().parents[1] / "data" / "manifests" / "stress-pool.json"
+FIRST, LAST = date(2016, 1, 1), date(2016, 12, 31)
+
+
+def build(generator: str) -> dict:
+    spec = importlib.util.spec_from_file_location("ems_red_generator", generator)
+    gen = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(gen)
+    days, d = [], FIRST
+    while d <= LAST:
+        rng = np.random.default_rng([2016, d.toordinal(), 23])
+        days.append({"date": d.isoformat(), "theta": check(gen.sample_theta(rng, d))})
+        d += timedelta(days=1)
+    return {"name": "stress-pool", "window": "holdout-normal-2016", "generator": Path(generator).name,
+            "generator_sha256": file_sha256(generator), "days": days,
+            "note": "dates and theta only; the 2016 rows stay sealed until a pre-registered holdout run"}
+
+
+def main(argv: list[str] | None = None) -> int:
+    ap = argparse.ArgumentParser()
+    ap.add_argument("--generator", required=True)
+    ap.add_argument("--out", default=str(OUT))
+    a = ap.parse_args(argv)
+    pool = build(a.generator)
+    Path(a.out).write_text(json.dumps(pool, indent=1) + "\n")
+    print(f"{a.out}: {len(pool['days'])} days, generator {pool['generator_sha256'][:12]}")
+    return 0
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
diff --git a/judges/ems/tests/test_red.py b/judges/ems/tests/test_red.py
new file mode 100644
index 0000000..c0bc355
--- /dev/null
+++ b/judges/ems/tests/test_red.py
@@ -0,0 +1,76 @@
+import importlib.util
+import json
+from datetime import date
+from pathlib import Path
+
+import numpy as np
+import pytest
+
+EMS = Path(__file__).resolve().parents[1]
+
+
+def _load(rel: str, name: str):
+    spec = importlib.util.spec_from_file_location(name, EMS / rel)
+    mod = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(mod)
+    return mod
+
+
+def test_red_generator_interface_returns_bounded_theta_from_the_date_only():
+    from ems.scenarios.bounds import check
+
+    gen = _load("experiments/ar/ems_red_sampler.py", "ems_red_gen_t")
+    rng = np.random.default_rng(0)
+    for d in (date(2016, 7, 4), date(2018, 1, 9)):
+        assert check(gen.sample_theta(rng, d))
+    assert len(gen.pick_days(rng, [date(2018, 1, 1), date(2018, 1, 2)], 5)) == 5
+
+
+def test_red_bench_refuses_a_generator_that_picks_non_dev_days():
+    bench = _load("experiments/ar/ems_red_bench.py", "ems_red_bench_t")
+
+    class Bad:
+        @staticmethod
+        def pick_days(rng, days, n):
+            return [date(2016, 6, 1)] * n
+
+        @staticmethod
+        def sample_theta(rng, d):
+            return {}
+
+    with pytest.raises(PermissionError):
+        bench.pool(Bad, 3, 0)
+
+
+def test_red_bench_refuses_out_of_bounds_theta(monkeypatch):
+    bench = _load("experiments/ar/ems_red_bench.py", "ems_red_bench_t2")
+    import ems.scenarios.core as core
+
+    monkeypatch.setattr(core, "is_dev_day", lambda d: True)
+    monkeypatch.setattr(core, "dev_days", lambda: [date(2018, 1, 1)])
+
+    class Greedy:
+        @staticmethod
+        def pick_days(rng, days, n):
+            return days[:1] * n
+
+        @staticmethod
+        def sample_theta(rng, d):
+            return {"demand": 2.0}
+
+    with pytest.raises(ValueError):
+        bench.pool(Greedy, 2, 0)
+
+
+def test_stress_pool_covers_2016_with_bounded_theta_and_pins_the_generator(tmp_path):
+    sp = _load("scripts/stress_pool.py", "ems_stress_pool_t")
+    gen = EMS / "experiments/ar/ems_red_sampler.py"
+    pool = sp.build(str(gen))
+    assert len(pool["days"]) == 366 and pool["days"][0]["date"] == "2016-01-01"
+    from loopkit.ledger import file_sha256
+
+    assert pool["generator_sha256"] == file_sha256(str(gen))
+    assert pool == sp.build(str(gen))  # deterministic
+    out = tmp_path / "pool.json"
+    sp.main(["--generator", str(gen), "--out", str(out)])
+    assert json.loads(out.read_text())["days"] == pool["days"]
diff --git a/scripts/ar_worktree.sh b/scripts/ar_worktree.sh
index 94b1c27..7862c8a 100755
--- a/scripts/ar_worktree.sh
+++ b/scripts/ar_worktree.sh
@@ -3,7 +3,8 @@
 #
 #   bash scripts/ar_worktree.sh blue cages-dry-run [base-ref]
 #
-# The worktree shares the main checkout's .venv (symlinked) and git hooks; prints the worktree path last.
+# The worktree shares the main checkout's .venv and the judges' data caches (symlinked) and git hooks; prints
+# the worktree path last.
 set -euo pipefail
 role=${1:-}; slug=${2:-}; base=${3:-main}
 case "$role" in blue|red) ;; *) echo "role must be blue or red" >&2; exit 2 ;; esac
@@ -15,4 +16,10 @@ if [ -e "$root/.venv" ]; then
   ln -s "$root/.venv" "$dest/.venv"
   for j in "$dest"/judges/*/; do [ -d "$j" ] && ln -s "$root/.venv" "${j%/}/.venv"; done
 fi
+# git-ignored caches the judges replay from (EMS day tables); shared read-only by every loop
+for c in "$root"/judges/*/data/cache; do
+  [ -d "$c" ] || continue
+  rel=${c#"$root"/}
+  [ -e "$dest/$rel" ] || ln -s "$c" "$dest/$rel"
+done
 echo "$dest"
````

**Report:** the test counts, the step 3 output lines, and the commit SHA.
