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
- Plan Task 3: created `ems/sim/fit.py` and `ems/sim/anchor_check.py` with the plan's exact content. Ran `.venv/bin/python -m ems.sim.fit` once (1m59s, 24 cores) and `.venv/bin/python -m ems.sim.anchor_check` exactly once (27s, exit 1 as expected). No code, inputs or tolerances were changed; no `confirm`-skill holdout applies (anchor days are calibration-window days; no ledger entries written).
- Plan Task 4: appended the frozen `## Known limits` section to `judges/ems/calibration/anchor_report.md` and added the 2026-11-01 M3c entry to `research/journal.md`. Final checks: `pytest -q` 110 passed, 1 skipped; `name_guard.py` and `ruff check .` clean.

## Results
- Task 1: 7/7 new tests pass; full suite 110 passed, 1 skipped.
- Task 2: `{"days": 1095, "zips": 207}`; fleet elasticities Bronx 0.732, Brooklyn 0.710, Manhattan 0.682, Queens 0.798, Staten Island 0.805; tier travel targets (p50/p90 s) tier 1: 262/438, tier 2: 351/605, tier 3: 466/1022. All match the plan's expected values.
- Task 3 fit: `fleet_k = 1.1980468750000002`; tier factors 1: 0.5455111215701232, 2: 0.7124637802133473, 3: 0.9570623592641511; sigma 0.05 in all five boroughs (fit run 1m59s on 24 cores).
- Task 3 anchor check (single run, 27s, exit 1, `Overall: FAIL`, 7/10): tier 1 p50 4.505/4.900 yes, p90 11.128/8.000 NO; tier 2 p50 5.810/6.433 yes, p90 14.361/11.033 NO; tier 3 p50 7.672/9.133 NO, p90 20.446/22.533 yes; held share 0.063/0.077 yes; transports/day 2875.689/2854.951 yes; offload median 35.036/36.017 yes; Jan-2018 held-share increase 0.163/0.121 yes. Every value matches the plan's expected table to the third decimal.

## Deviations
None so far.

## Blocked / questions
None so far.
