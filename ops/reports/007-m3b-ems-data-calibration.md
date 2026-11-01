# Report 007: M3b: EMS data ingest and calibration bundle (plan Tasks 1-10)
Status: done
Branch head at start: 13613b46fe3ad9fe9647f0afe2dbcd3295d3fec0  ·  at finish: 3097cef450bfdc2e5540fa5949c62c5edcb39197

## Summary
Executed plan Tasks 1–10 on `main`: new `ems` judge package with Socrata ingest, sealed holdout windows, cleaning, anchor selection, service/offload/fleet/travel fits, and a hashed calibration bundle with fit report. Calib rows match Socrata counts exactly (1,463,446 / 1,530,922 / 1,533,251); holdouts are counts-only manifests. All three fit-report sanity checks pass with documented explanations (Queens fleet 4th per its low call volume; tier-1 p90 8.0 min pooled vs a noisy single-day 10.2). Full suite: 98 passed, 1 skipped; ruff and name guard clean. No ledger entries written (dataset_release comes at the M3d freeze). Nothing here is a finding.

## Work done
- Claimed task 007 (prerequisite checked: `judges/cages/FROZEN` exists, ledger ends seq 11 `evaluator_update`).
- Plan Tasks 1–10, each committed with the plan's message and pushed; report updated after each part. See Plan tasks below for tests, failing/passing runs, and SHAs.
- Network steps: Socrata calib ingest (28:39, ~1.5 GB CSV → 230 MB Parquet), holdout counts (1.4 s), bounds aggregates (1:28, 6.15 MB), Geofabrik NY extract (3:21, 498 MB), OSRM build + serve on :5005 (stopped/removed after Task 10 Step 5; 2.3 GB data kept at `/home/ndgold/osrm-ny`), Census gazetteer (~1 MB) + OSRM table inside the bundle fit (3:43).
- Sanity investigations (read-only, calib window): borough call/held shares; per-day tier-1 p90 spread over the 61 normal-anchor days.

## Results
From committed files (`judges/ems/data/manifests/*.json`, `judges/ems/calibration/*`):
- Rows per calibration year: 2017: 1,463,446; 2018: 1,530,922; 2019: 1,533,251. Holdout counts: covid-a 161,820; omicron-b 141,950; normal-2016 1,441,211.
- Fleet median per borough (median of hourly medians, hours with ≥3 onsets; `fleet.json`): Brooklyn 61.5, Bronx 52.0, Manhattan 49.0, Queens 41.5, Staten Island 9.0.
- Offload beta per borough (`fit_report.md`): Bronx 0.0008, Brooklyn 0.0003, Manhattan 0.0009, Queens 0.0012, Staten Island 0.0033, UNKNOWN 0.0000.
- Normal-anchor p50/p90 per tier (`anchor_targets.json`): tier 1: 4.9 / 8.0 min; tier 2: 6.43 / 11.03 min; tier 3: 9.13 / 22.53 min. Held share 0.077, transports/day 2855.0, offload median 36.0 min.
- Flu held-share increase: 0.121 (`anchor_targets.json`).
- Bundle: 6,880,728 bytes total (`bounds_daily.csv` 6.15 MB + 9 bundle files + manifest); `verify_bundle` → BUNDLE_OK. Run times: see Work done.

## Deviations
1. `bounds_daily.csv` is 6.15 MB vs the plan's "well under 5 MB" estimate — content correct (200,286 daily rows, 14 years); 10 MB total budget still holds.
2. Task 6 `quantiles`: plan's `np.percentile` implementation fails the plan's own test on pinned numpy 2.5.4 (7.000000000000001 ≠ 7.0); replaced with knot-exact linear interpolation (max diff vs `np.percentile` 4.5e-12 on 50k draws). The test was NOT weakened.
3. OSRM data at `/home/ndgold/osrm-ny` instead of `/mnt/data1/osrm-ny` (`/mnt/data1` root-owned, unwritable; no escalation path). Same bytes/image/port.
4. Minor: Task 1 failing import error reads `No module named 'ems.tiers'` (plan says `'ems'`) — same failure class.

## Blocked / questions
- None blocking. For Dylan's review before M3c: the fit report (`judges/ems/calibration/fit_report.md`) — per adaptation 6, M3c not started. Optional follow-ups for the reviewer: (a) confirm the Queens-fleet and tier-1-p90 explanations above; (b) whether to move `/home/ndgold/osrm-ny` to `/mnt/data1/osrm-ny` (needs root); (c) whether Task 6's knot-exact `quantiles` should be kept as-is in the frozen bundle path.

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

### Task 6: Service-time quantile tables
- Tests written: `judges/ems/tests/test_service.py` (quantiles, groups, tables). Test kept byte-identical to the plan.
- Failing run first lines: `F [100%]`, `ModuleNotFoundError: No module named 'ems.calibrate.service'`.
- Passing run: `1 passed` (full EMS suite: 12 passed), `ruff check .` clean, `name_guard.py` clean.
- Deviation (implementation, not test): the plan's `quantiles` (`np.percentile(x, linspace(0,100,q))`) fails the plan's own test on pinned numpy 2.5.4 — knot value 7 comes back as 7.000000000000001 (`At index 7 diff: 7.000000000000001 != 7.0`). Replaced with direct linear interpolation at `linspace(0, n-1, q)` positions, which is knot-exact. Verified equivalent to `np.percentile`: max abs diff 4.5e-12 on 50k exponential draws. The test was NOT weakened.
- Commit: `5393493ceaf06481e3b91dca1199d4f67f8c42a0` ("EMS: service-time quantile tables per call-type group").

### Task 7: Offload base and load coefficient
- Tests written: `judges/ems/tests/test_offload.py` (prior-load window counts, known-slope recovery).
- Failing run first lines: `FF [100%]`, `ModuleNotFoundError: No module named 'ems.calibrate.offload'`.
- Passing run: `2 passed`, `ruff check .` clean, `name_guard.py` clean.
- Commit: `4579d4f179d5e318d0c8e6f361171bb19110c4ab` ("EMS: offload base tables and per-borough load coefficient").

### Task 8: Fleet inference from held onsets
- Tests written: `judges/ems/tests/test_fleet.py` (half-open concurrency counts, M/M/10 capacity recovery).
- Failing run first lines: `FF [100%]`, `ModuleNotFoundError: No module named 'ems.calibrate.fleet'`.
- Passing run: `2 passed`, `ruff check .` clean, `name_guard.py` clean.
- Commit: `c6341305fa3d65eb7988f0fb7b6fb62dc32f418d` ("EMS: fleet inference from busy-unit concurrency at held onsets").

### Task 9: Travel targets, zip centroids, OSRM matrix
- Tests written: `judges/ems/tests/test_travel.py` (borough×hour targets, gazetteer centroids, OSRM table parsing + lon/lat order).
- Failing run first lines: `FFF [100%]`, `ModuleNotFoundError: No module named 'ems.calibrate.travel'`.
- Passing run: `3 passed`, `ruff check .` clean, `name_guard.py` clean.
- Commit: `601351ac8da1dda8a143dedc5640637e07a65514` ("EMS: travel targets, ZCTA centroids and OSRM table client").
- Step 5 (OSRM, adaptation 4 — wall time + volume): download 3:20.95 (498,401,978 bytes, matches plan's 498 MB); `docker pull ghcr.io/project-osrm/osrm-backend:latest` 14.31 s; extract 1:51.14 (peak RAM 5.5 GB); partition 0:40.49; customize 0:08.30. `osrm-ny` serving on 127.0.0.1:5005; route check returned `"code":"Ok"` (Bronx→Manhattan 1626.9 s).
- Deviation (path, not content): OSRM data lives at `/home/ndgold/osrm-ny`, not `/mnt/data1/osrm-ny` — `/mnt/data1` is root-owned (drwxr-xr-x) and unwritable by ndgold, and escalated execution is unavailable (approval prompts disabled). Same extract bytes, same image, same :5005 port; Task 10 only queries localhost. Dylan can move it later if the /mnt/data1 path matters.

### Task 10: Bundle, fit report and the full calibration run
- Tests written: `judges/ems/tests/test_bundle.py` (write/verify round-trip, tamper detection).
- Failing run first lines: `F [100%]`, `ModuleNotFoundError: No module named 'ems.calibrate.bundle'` (shown as `from ems.calibrate.bundle import ...` failure).
- Passing run: `1 passed`; final full suite `98 passed, 1 skipped`, `ruff check .` clean, `name_guard.py` clean.
- Step 5 (adaptation 4 — wall time + volume): `python -m ems.calibrate.bundle` wall 3:43.24 — 4,238,644 fit rows on 1,027 fit days (68 anchor days excluded, 48 dropped bad severity), exactly the plan's ~1,027. Inside the run: Census gazetteer ZIP (~1 MB) + one OSRM table query for 207 zips. `verify_bundle` → BUNDLE_OK. Bundle dir 6,880,728 bytes (6.6 MB, under the 10 MB budget; includes the 6.15 MB `bounds_daily.csv`).
- Sanity checks (all pass, no tuning): fleet medians are tens of units with Brooklyn largest (61.5) — Queens is 4th (41.5), which the data explains (fewest calls/day, 794, and lowest held share, 1.2%, of the big 4; the plan's "Queens largest" parenthetical was population-based, not data-based); every offload beta ≥ 0 (0.0000–0.0033); tier-1 p90 = 8.0 min vs the single-day 10.2 — per-day tier-1 p90s over the 61 normal days range 6.65–10.02 (n≈47/day, noisy), and 2019-03-28 (10.01) is the maximum, so the pooled 8.0 is the stable estimate. Tiers 2/3 match the single-day values (11.0 vs 11.3; 22.5 vs 19.1/22.2).
- Step 6: journal entry appended; `osrm-ny` stopped and removed per adaptation 5 (data kept: 2.3 GB at `/home/ndgold/osrm-ny`); pushed to `main` per adaptation 6. M3c NOT started.
- Commit: `9f14fdf9d95acc3ac0e697166eddced642ac6fb5` ("EMS: calibration bundle and fit report (2017-2019 fit days)").
