# Report 009: M3b fix 2: offload without a load term; surge offload becomes a bounded scenario factor
Status: in_progress
Branch head at start: 663161e634b071752f99e5001cd59d121397d2ec  ·  at finish: <sha>

## Summary
(TBD)

## Work done
- Claimed task 009.
- Part 1 (base-only): added `fit_offload_base(df)` to `judges/ems/ems/calibrate/offload.py` (returns `{"model": "base", "base": ...}` with the same 101-point per-borough-per-hour tables; `fit_offload`, `fit_offload_ratio`, `jan2018_check` untouched for the record) plus `test_fit_offload_base_has_no_load_term` (fails before, passes after). `bundle.py` now fits `fit_offload_base(fit)`, no longer writes `offload_check`, and reads the null rows for the fit report from the renamed evidence file. `offload_check.json` renamed to `offload_load_null.json` with a top-level `note`; borough rows byte-identical to task 008 (verified against git HEAD). `pytest tests/test_offload.py tests/test_bundle.py`: 6 passed. `ruff check`: clean. Commit: (part 1 SHA).

## Results
(TBD: inflation table, o_max, bundle size, test runs, commit SHAs.)

## Deviations
None yet.

## Blocked / questions
None yet.
