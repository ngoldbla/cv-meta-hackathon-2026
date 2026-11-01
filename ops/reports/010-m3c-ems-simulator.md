# Report 010: M3c: EMS simulator, b0, fit and the single anchor check (plan Tasks 1-4)
Status: in_progress
Branch head at start: 79b9af4  ·  at finish: <tbd>

## Summary
Executing `docs/superpowers/plans/2026-11-01-m3c-ems-simulator.md` Tasks 1-4 exactly. (To be completed.)

## Work done
- Claimed task 010.
- Plan Task 1: created `judges/ems/tests/test_sim_core.py` first (failed as expected with `ModuleNotFoundError: No module named 'ems.policy'`), then `ems/policy/{__init__,api,practice}.py` and `ems/sim/{__init__,calib,core}.py` with the plan's exact content. `pytest judges/ems/tests/test_sim_core.py -q`: 7 passed (0.37s). Full `pytest -q`: 110 passed, 1 skipped (28.5s). `name_guard.py` and `ruff check .`: pass.

## Work done (cont.)
- Plan Task 2: created `ems/sim/trace.py` and `ems/sim/build.py` with the plan's exact content. Ran `.venv/bin/python -m ems.sim.build` (3m35s): wrote 1095 day tables to `judges/ems/data/cache/days/` (git-ignored) and `judges/ems/calibration/sim_inputs.json`. Full checks pass: `pytest -q` 110 passed, 1 skipped; `name_guard.py` and `ruff check .` clean.

## Results
- Task 1: 7/7 new tests pass; full suite 110 passed, 1 skipped.
- Task 2: `{"days": 1095, "zips": 207}`; fleet elasticities Bronx 0.732, Brooklyn 0.710, Manhattan 0.682, Queens 0.798, Staten Island 0.805; tier travel targets (p50/p90 s) tier 1: 262/438, tier 2: 351/605, tier 3: 466/1022. All match the plan's expected values.

## Deviations
None so far.

## Blocked / questions
None so far.
