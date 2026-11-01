# Report 009: M3b fix 2: offload without a load term; surge offload becomes a bounded scenario factor
Status: in_progress
Branch head at start: 663161e634b071752f99e5001cd59d121397d2ec  ·  at finish: <sha>

## Summary
Removed the endogenous load term: `offload.json` is now `{"model": "base"}` with the same 101-point base tables (verified identical to task 008), and the task-008 null result is kept as committed evidence in `offload_load_null.json`. Measured the surge-offload scenario factor θ "extra offload inflation" over the 2017–2019 calibration window: p50 ≈ 1.00 in every borough, o_max (citywide max) = 1.1511. Re-ran the full bundle (identical counts, BUNDLE_OK) with the new fit report sections. Nothing here is a finding; no ledger entries written.

## Work done
- Claimed task 009.
- Part 1 (base-only): added `fit_offload_base(df)` to `judges/ems/ems/calibrate/offload.py` (returns `{"model": "base", "base": ...}` with the same 101-point per-borough-per-hour tables; `fit_offload`, `fit_offload_ratio`, `jan2018_check` untouched for the record) plus `test_fit_offload_base_has_no_load_term` (fails before, passes after). `bundle.py` now fits `fit_offload_base(fit)`, no longer writes `offload_check`, and reads the null rows for the fit report from the renamed evidence file. `offload_check.json` renamed to `offload_load_null.json` with a top-level `note`; borough rows byte-identical to task 008 (verified against git HEAD). `pytest tests/test_offload.py tests/test_bundle.py`: 6 passed. `ruff check`: clean. Commit: `15b8b3b`.
- Part 2 (inflation range): added `offload_inflation_range(df)` to `judges/ems/ems/calibrate/offload.py` — per borough, each day's median `offload_s` over the pooled median of the previous 28 calendar days, qualifying only with ≥20 days with transports in the window; returns `{borough: {p50, p95, p99, max, n_days}}` (linear quantiles; boroughs with no qualifying day skipped). Tests (written first, failed on import, then passed): `test_offload_inflation_range_known_max` (30 flat days + a 2.5× spike day → max 2.5, n_days 11, p50 1.0) and `test_offload_inflation_range_skips_short_windows` (10 days → `{}`). `bundle.py` adds `offload_inflation_range(df)` on the full 2017–2019 frame as `offload_inflation.json`; the fit report gains the inflation table, the o_max line (citywide max of max), and the calibration-window-only note. Report builder smoke-tested on synthetic parts. `pytest`: 8 passed; `ruff check` clean; `ruff format` clean on `offload.py`/tests (`bundle.py` left in hand style per baseline). Commit: `fdc502a`.
- Part 3 (bundle): restarted `osrm-ny` from `~/osrm-ny` on `127.0.0.1:5005` (route check `"code":"Ok"`, Bronx→Manhattan 1626.9 s, same as tasks 007/008); `python -m ems.calibrate.bundle` from `judges/ems` took 3:35.60 with identical counts to tasks 007/008 (4,238,644 rows / 1,027 fit days / 68 anchor days / 48 dropped); `verify_bundle` → BUNDLE_OK; container stopped and removed. Only `bundle_manifest.json`, `fit_report.md`, `offload.json` changed plus new `offload_inflation.json` — all other bundle bytes identical; `offload.json` base verified identical to task 008. Gates: repo-root `pytest -q` → 103 passed, 1 skipped; `ruff check .` → clean; `scripts/name_guard.py` → exit 0. Journal entry appended. Commit: (part 3 SHA).

## Results
Inflation range (`judges/ems/calibration/offload_inflation.json`, also tabulated in `judges/ems/calibration/fit_report.md`):

| borough | p50 | p95 | p99 | max | n_days |
|---|---|---|---|---|---|
| BRONX | 0.9983 | 1.0447 | 1.0610 | 1.0820 | 1075 |
| BROOKLYN | 1.0002 | 1.0234 | 1.0346 | 1.0571 | 1075 |
| MANHATTAN | 1.0013 | 1.0269 | 1.0365 | 1.0495 | 1075 |
| QUEENS | 1.0005 | 1.0355 | 1.0498 | 1.0740 | 1075 |
| RICHMOND / STATEN ISLAND | 1.0024 | 1.0697 | 1.1034 | 1.1511 | 1075 |

o_max (citywide maximum of max; bound for the M3d scenario factor θ): 1.1511.

Bundle size: 6,880,117 bytes (6.6 MB) for `judges/ems/calibration/`.

Test runs: repo-root `pytest -q` → 103 passed, 1 skipped (100 at task 008 + 3 new); `judges/ems` `pytest -q` → 25 passed; `ruff check .` clean; `ruff format --check` clean on `offload.py` and `test_offload.py`; `scripts/name_guard.py` exit 0.

Commits: claim `f5d1fdb`, part 1 `15b8b3b`, part 2 `fdc502a`, part 3 (part 3 SHA).

## Deviations
No deviations from the task. Unspecified mechanics, chosen as follows and documented in code:
- The 28-day window median is the pooled median of `offload_s` over the previous 28 calendar days (same pooled-median construction as `jan2018_check`); window-day counting uses transported rows (`transported & t_hosp.notna()`), medians use valid offload rows (`offload_s.notna() & > 0`).
- Boroughs with no qualifying day are skipped from `offload_inflation.json` (hits only UNKNOWN: 3 transported rows on 3 distinct days, so no 20-day window is possible).
- p50/p95/p99 are linear-interpolation quantiles (`np.quantile` defaults).
- `offload_load_null.json` is committed evidence, not a bundle part: it is not in `bundle_manifest.json` (same standing as `fit_report.md` and `bounds_daily.csv`). The fit report's null-result table is read from it at bundle time, so the numbers match by construction.
- `fit_offload_base` fits the same fit-days frame the bundle used before; the base tables are verified identical to task 008.

## Blocked / questions
None. Per the task, nothing here is a finding and no ledger entries were written.
