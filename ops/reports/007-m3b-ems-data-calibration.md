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

### Task 2: Windows and the holdout refusal
- Tests written: `judges/ems/tests/test_windows.py` (windows match spec; refusal on any overlap, pass otherwise).
- Failing run first lines: `FF [100%]`, `ModuleNotFoundError: No module named 'ems.data.windows'`.
- Passing run: `2 passed`, `ruff check .` clean, `name_guard.py` clean.
- Commit: `855aa72b522058cf2d27e74cf4dfd74d98a2a946` ("EMS: data windows with the sealed holdout refusal").

### Task 3: Socrata client, store and ingest
- Tests written: `judges/ems/tests/test_socrata_store.py` (keyset paging, holdout refusal for rows/aggregates but not counts, order-independent hash + manifest verify, load refusal).
- Failing run first lines: `FFFF [100%]`, `ModuleNotFoundError: No module named 'ems.data.socrata'`.
- Passing run: `4 passed`, `ruff check .` clean, `name_guard.py` clean.
- Network (adaptation 4):
  - `calib`: wall 28:38.97; rows 1,463,446 / 1,530,922 / 1,533,251 — exact matches of the plan's 2026-10-29 counts, each equal to Socrata `count(*)` (ingest raises on mismatch; exit 0). Cache parquets 230 MB total; CSV transferred ≈ 1.5 GB (plan estimate, consistent with ~350 B/row × 4.53 M rows).
  - `holdout-counts`: wall 1.43 s; covid-a 161,820, omicron-b 141,950, normal-2016 1,441,211. Counts only; `sha256: null` in all three manifests; no rows downloaded (code path calls `count()` only).
  - `bounds`: wall 1:27.70; `bounds_daily.csv` 200,286 data rows, 6,149,899 bytes.
- Cache round-trip: `load('calib-2019')` → 1,533,251 rows, manifest hash verified.
- Deviation: `bounds_daily.csv` is 6.15 MB, over the plan's "well under 5 MB" estimate. Content is correct (daily borough×severity aggregates, 14 years); recorded here, continuing since all correctness checks pass and the 10 MB committed-output budget still holds.
- Commit: `06b325a26623fb473c93c5140420cca4d6b00e71` ("EMS: Socrata ingest, manifests (holdout = counts only), bounds aggregates"). `git status | grep -c cache` → 0 (cache ignored).

### Task 4: Cleaning and derived durations
- Tests written: `judges/ems/tests/test_clean.py` (types, tiers, durations, bad-severity drop).
- Failing run first lines: `F [100%]`, `ModuleNotFoundError: No module named 'ems.data.clean'`.
- Passing run: `1 passed`, `ruff check .` clean, `name_guard.py` clean.
- Commit: `3afd9c8c38a203909ce9099074b70a9b73bc11f9` ("EMS: typed cleaning and derived durations").

### Task 5: Anchor days and anchor targets
- Tests written: `judges/ems/tests/test_anchors_select.py` (selection rules, targets incl. flu increase).
- Failing run first lines: `FF [100%]`, `ModuleNotFoundError: No module named 'ems.calibrate.anchors'`.
- Passing run: `2 passed`, `ruff check .` clean, `name_guard.py` clean.
- Commit: `c6deeca05c6c87248743a0a1cbd20e75456ddfff` ("EMS: anchor-day selection and observed anchor targets").
