# Report 008: M3b fix: refit hospital offload with a 24-hour surge ratio, checked on the Jan 2018 anchor days
Status: in_progress
Branch head at start: 5c95093393c12c45baa5fc012f24b4c71d990ca4  ·  at finish: <sha>

## Summary
Parts 1–2 done: `fit_offload_ratio` and `jan2018_check` added, all 4 offload tests pass.

## Work done
- Part 1 (model): added `fit_offload_ratio(df, window_s=86400)` to `judges/ems/ems/calibrate/offload.py` (`prior_load`, `fit_offload` untouched); added the task's `test_ratio_fit_recovers_a_known_slope` verbatim to `judges/ems/tests/test_offload.py`. `pytest judges/ems/tests/test_offload.py`: 3 passed. `ruff check` on both files: clean. Commit: `c194c5b`.
- Part 2 (check): added `jan2018_check(df, anchor, fit, tol=0.015)` to the same module (base days = 28 days before the first flu day minus flu days, mirroring `anchor_targets`; `UNKNOWN` skipped; plain floats/bools for JSON) plus `test_jan2018_check_known_obs_and_pred` (synthetic: obs 1.1, pred exp(0.1), ok True; UNKNOWN row skipped). `pytest`: 4 passed; `ruff check` and `ruff format --check`: clean. Commit: <sha-part2>.

## Results
(none yet — bundle rerun in Part 3)

## Deviations
(none yet)

## Blocked / questions
(none yet)
