# Report 009: M3b fix 2: offload without a load term; surge offload becomes a bounded scenario factor
Status: in_progress
Branch head at start: 663161e634b071752f99e5001cd59d121397d2ec  ·  at finish: <sha>

## Summary
(TBD)

## Work done
- Claimed task 009.
- Part 1 (base-only): added `fit_offload_base(df)` to `judges/ems/ems/calibrate/offload.py` (returns `{"model": "base", "base": ...}` with the same 101-point per-borough-per-hour tables; `fit_offload`, `fit_offload_ratio`, `jan2018_check` untouched for the record) plus `test_fit_offload_base_has_no_load_term` (fails before, passes after). `bundle.py` now fits `fit_offload_base(fit)`, no longer writes `offload_check`, and reads the null rows for the fit report from the renamed evidence file. `offload_check.json` renamed to `offload_load_null.json` with a top-level `note`; borough rows byte-identical to task 008 (verified against git HEAD). `pytest tests/test_offload.py tests/test_bundle.py`: 6 passed. `ruff check`: clean. Commit: `15b8b3b`.
- Part 2 (inflation range): added `offload_inflation_range(df)` to `judges/ems/ems/calibrate/offload.py` — per borough, each day's median `offload_s` over the pooled median of the previous 28 calendar days, qualifying only with ≥20 days with transports in the window; returns `{borough: {p50, p95, p99, max, n_days}}` (linear quantiles; boroughs with no qualifying day skipped). Tests (written first, failed on import, then passed): `test_offload_inflation_range_known_max` (30 flat days + a 2.5× spike day → max 2.5, n_days 11, p50 1.0) and `test_offload_inflation_range_skips_short_windows` (10 days → `{}`). `bundle.py` adds `offload_inflation_range(df)` on the full 2017–2019 frame as `offload_inflation.json`; the fit report gains the inflation table, the o_max line (citywide max of max), and the calibration-window-only note. Report builder smoke-tested on synthetic parts. `pytest`: 8 passed; `ruff check` clean; `ruff format` clean on `offload.py`/tests (`bundle.py` left in hand style per baseline). Commit: (part 2 SHA).

## Results
(TBD: inflation table, o_max, bundle size, test runs, commit SHAs.)

## Deviations
None yet.

## Blocked / questions
None yet.
