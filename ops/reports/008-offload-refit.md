# Report 008: M3b fix: refit hospital offload with a 24-hour surge ratio, checked on the Jan 2018 anchor days
Status: in_progress
Branch head at start: 5c95093393c12c45baa5fc012f24b4c71d990ca4  ·  at finish: <sha>

## Summary
Part 1 done: `fit_offload_ratio` added, recovery test passes.

## Work done
- Part 1 (model): added `fit_offload_ratio(df, window_s=86400)` to `judges/ems/ems/calibrate/offload.py` (`prior_load`, `fit_offload` untouched); added the task's `test_ratio_fit_recovers_a_known_slope` verbatim to `judges/ems/tests/test_offload.py`. `pytest judges/ems/tests/test_offload.py`: 3 passed. `ruff check` on both files: clean. Commit: <sha-part1>.

## Results
(none yet — bundle rerun in Part 3)

## Deviations
(none yet)

## Blocked / questions
(none yet)
