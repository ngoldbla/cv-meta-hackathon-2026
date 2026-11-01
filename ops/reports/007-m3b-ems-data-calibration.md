# Report 007: M3b: EMS data ingest and calibration bundle (plan Tasks 1-10)
Status: in_progress
Branch head at start: 13613b46fe3ad9fe9647f0afe2dbcd3295d3fec0  ·  at finish: <sha>

## Summary
Started task 007. Prerequisite holds (FROZEN exists, ledger ends seq 11 evaluator_update). Executing plan Tasks 1-10 on main.

## Work done
- Claimed task 007.

## Results
(none yet)

## Deviations
(none yet)

## Blocked / questions
(none yet)

## Plan tasks

### Task 1: Package skeleton, dependencies, tiers
- Tests written: `judges/ems/tests/test_tiers.py` (tier mapping/targets/weights, unknown-severity rejection).
- Failing run first lines: `FF [100%]`, `ModuleNotFoundError: No module named 'ems.tiers'` (plan expects `No module named 'ems'`; same failure class — package body not yet written).
- Passing run: `2 passed`, `ruff check .` clean, `name_guard.py` clean.
- Pinned install printed `2.5.4 2.3.3 21.0.0 2.11.0+cu128` as expected.
- Commit: `8d3d709235d713abd740218715d8ac340f6731ad` ("EMS judge skeleton: package wiring and tiers").
