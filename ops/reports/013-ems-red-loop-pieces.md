# Report 013: M4: red-loop generator, red bench, stress-pool builder, worktree cache link
Status: in_progress
Branch head at start: 71a3c16d440c8cb6d9ec353a7dd07e8b3db9c0f4  ·  at finish: <sha>

## Summary
Task claimed; patch applied cleanly via `git apply`. Full suite: 128 passed, 1 skipped. `name_guard` passed, ruff clean. Red bench on 200 dev days printed `METRIC regret_b1=500.25` in ~63 s, matching the task's expected value.

## Work done
- Claimed task 013 (status -> in_progress, report created). Commit `1b3374a`, pushed.
- Step 1: extracted the task's patch (lines 31-306) to a `mktemp` file; `git apply --check` passed, `git apply` applied cleanly. New files: `judges/ems/experiments/ar/ems_red_bench.py`, `judges/ems/experiments/ar/ems_red_sampler.py`, `judges/ems/scripts/stress_pool.py`, `judges/ems/tests/test_red.py`; modified: `scripts/ar_worktree.sh`.
- Step 2: `.venv/bin/python -m pytest -q` -> `128 passed, 1 skipped` (28.6 s); `.venv/bin/python scripts/name_guard.py` -> `All checks passed!`; `.venv/bin/ruff check .` -> clean, no findings.
- Step 3: from `judges/ems`, `../../.venv/bin/python experiments/ar/ems_red_bench.py --n 200` -> last line `METRIC regret_b1=500.25` (62.9 s, run `runs/ar-red-ems/20261101-174754`, git-ignored).

## Results
| Check | Expected | Observed |
|---|---|---|
| pytest | 128 passed, 1 skipped | 128 passed, 1 skipped |
| name_guard | pass | All checks passed! |
| ruff | clean | clean |
| red bench METRIC | `METRIC regret_b1=500.25` | `METRIC regret_b1=500.25` |

Bench detail line: `{"run": "runs/ar-red-ems/20261101-174754", "seconds": 62.9, "b1_primary": 10894.52, "oracle_primary": 12877.83, "days_with_regret": 72, "mean_demand": 1.077, "mean_unavailable": 0.109}` (copied from stdout; the run dir is git-ignored).

## Deviations
None. No ledger entries written; `scripts/stress_pool.py` not run against the real manifests folder, per the task.

## Blocked / questions
None.
