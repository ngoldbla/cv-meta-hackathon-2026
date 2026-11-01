# Report 012: M3d correction: frozen scenario mechanics split out of the red-loop sampler
Status: done
Branch head at start: c3bde9e57c81f80a16b08736d124d7a2b80c7ec9  ·  at finish: <sha>

## Summary
Applied the reviewer's patch via `git apply` (no hand edits): `perturb()` and `dev_days()` moved unchanged from `ems/scenarios/sampler.py` into new frozen `ems/scenarios/core.py`, dev set pinned to the 2017–2019 calibration window minus 68 anchor days (1,027 days), and `build_sim` now refuses cached days outside the dev set. Full suite gives 123 passed / 1 skipped, ruff and name_guard clean, and the task-011 benchmark reproduces exactly (`"primary": 11247.14150209779`, `METRIC ratio_b1=1.0000`).

## Work done
- Step 1: extracted the patch from the task file to a `mktemp` file; `git apply --check` passed, then `git apply`. Files: `judges/ems/ems/cf.py`, `judges/ems/ems/evaluate.py`, `judges/ems/ems/scenarios/sampler.py`, `judges/ems/tests/test_scenarios.py` modified; `judges/ems/ems/scenarios/core.py` created.
- Step 2: `.venv/bin/python -m pytest -q` → 123 passed, 1 skipped; `.venv/bin/python scripts/name_guard.py` → pass; `.venv/bin/ruff check .` → All checks passed.
- Step 3: from `judges/ems`, `rm -rf runs/ems-ref && ../../.venv/bin/python experiments/ar/ems_blue_bench.py --n 200` → `"primary": 11247.14150209779`, `METRIC ratio_b1=1.0000`. Dev-day count verified separately: 1,027.
- Step 4: commit + push (this report's finish SHA below).

## Results
| check | result | source |
|---|---|---|
| pytest | 123 passed, 1 skipped | step 2 run |
| name_guard | pass (exit 0) | step 2 run |
| ruff | All checks passed | step 2 run |
| bench primary | 11247.14150209779 | step 3 run (`runs/ar-blue-ems/20261101-170852`) |
| bench METRIC | ratio_b1=1.0000 | step 3 run |
| dev days | 1027 | `ems.scenarios.core.dev_days()` |

## Deviations
None. Patch applied unmodified; no retries needed. No `judges/ems/FROZEN` created and no ledger entries written, per the task.

## Blocked / questions
None.
