# Report 014: Autoresearch red loop: ems-stress
Status: done
Branch head at start: 82b3634d1546019807fa5877ffedb5b22ad0e541  ·  at finish: 38137300d71e4010d2c9ee90cc9b078897888201

## Summary
Ran the full 20-iteration red loop against b1 on 200 dev days (branch `ar/red/ems-stress`, head `e0f5b5c`, pushed, unmerged). Regret rose from the 500.25 baseline to a best kept 866.21 (#14): thin staffing (unavailable 0.25), max urgency, demand 1.0 on ordinary weekdays and at the load cap on weekends, federal holidays and Feb/Mar/Nov, with offload and concentration left nominal. Raw demand and concentration extremes both lower regret; staffing pressure plus date-targeted demand is what opens the foresight gap. Audit: 21 entries, 0 problems. Nothing from this loop is a finding: no ledger entries, no stress pool, no holdout touch.

## Work done
- Claimed task 014 on main (task 013 was done).
- Created worktree via `bash scripts/ar_worktree.sh red ems-stress`; cache holds 1,095 day files.
- Wrote `research/autoresearch/ems-stress/{autoresearch.md,autoresearch.sh,autoresearch.jsonl}` (all loop work in the worktree on `ar/red/ems-stress`).
- Ran iterations 0-20, one change each, committing and pushing every iteration; journal entries at baseline, #5, #10, #15 and end.
- Kept-commit checks: `.venv/bin/python -m pytest -q` (128 passed, 1 skipped) and `scripts/name_guard.py` clean before #4, #5, #10, #13, #14.
- Ran `ar_check.py` in the worktree (output below); pushed the branch; did not merge.

## Results
Best kept value: `regret_b1=866.21` at iteration 14, commit `48a4b51573987d89f69b5ab7ba3f8e8bf7b0c1ba` (`Autoresearch ems-stress #14: keep - low-volume-month demand bump`). Log: `research/autoresearch/ems-stress/autoresearch.jsonl` on `ar/red/ems-stress` (evidence `bench.log` alongside).

| iter | hypothesis | value | decision | seconds |
| --- | --- | --- | --- | --- |
| 0 | baseline: nominal sampler, random days | 500.25 | baseline | 62.0 |
| 1 | max concentration (3 zips, 104 calls) raises regret | 491.75 | revert | 62.2 |
| 2 | max demand load (demand 1.413, unavailable 0) raises regret | null | crash | 1.1 |
| 3 | max demand load (demand 1.413, unavailable 0) raises regret | 142.37 | revert | 92.6 |
| 4 | max load via unavailability (0.25, demand at cap) raises regret | 682.39 | keep | 47.8 |
| 5 | max urgent share (1.153) on top of kept load raises regret | 694.06 | keep | 47.9 |
| 6 | max offload (1.151) on top of kept state raises regret | 597.59 | revert | 48.5 |
| 7 | no concentration (0 zips, 0 calls) on kept state raises regret | 638.31 | revert | 44.9 |
| 8 | min offload (1.0) on kept state raises regret | 598.67 | revert | 49.0 |
| 9 | interior load (unavailable 0.125, demand at cap) beats the corner | 93.13 | revert | 64.5 |
| 10 | thin staffing with no demand perturbation (demand 1.0) beats cap-binding demand | 733.07 | keep | 45.2 |
| 11 | min demand (0.9) with thin staffing beats demand 1.0 | 639.42 | revert | 41.7 |
| 12 | fixed-moderate concentration (2 zips, 52 calls) beats nominal random | 594.87 | revert | 44.1 |
| 13 | weekends/holidays to cap demand (low-volume days into the sweet spot) | 815.11 | keep | 45.0 |
| 14 | low-volume months (Feb/Mar/Nov) to cap demand, like weekends | 866.21 | keep | 46.9 |
| 15 | summer months (May/Jun/Jul) eased to demand 0.95 | 859.87 | revert | 43.7 |
| 16 | extend demand bump to April | 840.33 | revert | 44.1 |
| 17 | milder date bump (demand 1.03) beats cap-level bump | 767.51 | revert | 44.0 |
| 18 | concentration always present (zips 1-3 by date) beats nominal random | 765.56 | revert | 44.3 |
| 19 | fixed mid offload (1.0755) beats nominal random | 831.97 | revert | 43.2 |
| 20 | max offload on bumped (low-volume) days only | 794.89 | revert | 42.8 |

Audit output (run in the worktree before finishing):
```
21 entries, 0 problems
```
Command: `.venv/bin/python scripts/ar_check.py --log research/autoresearch/ems-stress/autoresearch.jsonl --direction higher --scope judges/ems/experiments/ar/ems_red_sampler.py --branch ar/red/ems-stress --base main`

Final `judges/ems/experiments/ar/ems_red_sampler.py` (at `ar/red/ems-stress` head `e0f5b5c`):
```python
"""Red-loop scenario generator (the red autoresearch loop edits this file only). Starts as the nominal sampler.

Interface (fixed by the frozen red bench and stress-pool builder):
- sample_theta(rng, d) -> theta for calendar date d. It may use only d itself (weekday, month, holiday), never the
  day's calls, because the same function is applied to sealed holdout dates. theta must pass ems.scenarios.bounds.check.
- pick_days(rng, days, n) -> n dates from `days` (dev only; never used for holdout pools).
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np

from ems.scenarios.bounds import LOAD_CAP, check
from ems.scenarios.sampler import sample_theta as nominal_theta


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    first = date(year, month, 1)
    if n > 0:
        return date(year, month, 1 + (weekday - first.weekday()) % 7 + 7 * (n - 1))
    last = date(year + (month == 12), month % 12 + 1, 1)
    return last - timedelta(days=1 + (last.weekday() - 1 - weekday) % 7)


def _federal_holiday(d: date) -> bool:
    y = d.year
    fixed = {(1, 1), (7, 4), (11, 11), (12, 25)}
    if (d.month, d.day) in fixed:
        return True
    floaters = {_nth_weekday(y, 1, 0, 3), _nth_weekday(y, 2, 0, 3), _nth_weekday(y, 5, 0, -1),
                _nth_weekday(y, 9, 0, 1), _nth_weekday(y, 10, 0, 2), _nth_weekday(y, 11, 3, 4)}
    return d in floaters


def sample_theta(rng: np.random.Generator, d: date) -> dict:
    t = nominal_theta(rng)
    t["unavailable"] = 0.25
    t["demand"] = 1.0
    if d.weekday() >= 5 or _federal_holiday(d) or d.month in (2, 3, 11):
        t["demand"] = LOAD_CAP * 0.75 - 1e-6
    t["urgent_share"] = 1.153
    return check(t)


def pick_days(rng: np.random.Generator, days: list[date], n: int) -> list[date]:
    return [days[i] for i in rng.choice(len(days), size=n, replace=n > len(days))]
```

What the loop learned (dev only, not findings): regret is maximized by thin staffing with modest demand, not by raw volume (#3: 142.37, #9: 93.13); max urgency helps a little; offload and concentration extremes both lose to nominal randomness, and fixed-mid values lose too, so variance in those channels is load-bearing; b1's borough-hour expectations ignore day-of-week, and weekends/holidays run ~7% below mean volume (dev-only analysis), so pushing low-volume dates to the load cap widens the foresight gap.

## Deviations
- `pick_days` deliberately left uniform: it only shapes the bench, never the sealed pool (all 366 dates of 2016), so tuning it would inflate the metric without improving the artifact. The bench stays an honest estimate of pool regret.
- #2 crashed on a missing `check` import (my edit bug after a revert); logged as `crash` with `value: null`, hypothesis retried as #3.
- #10's keep commit was first blocked by the pre-commit hook (unused `LOAD_CAP` import); removed the import (behavior-identical) and committed.
- `seconds` for #0/#1: #0 measured with `date +%s` (62.0); #1 uses the bench's own timer (62.2) after `bc` proved unavailable; #2 onward measured with `date +%s%N`.
- Date-volume analysis (`/tmp/dow_volume.py`, dev days only) informed #13/#14; it is not a loop artifact and is not committed.

## Friction with the skill text
- The skill's `commit`-field definition (SHA of the tested tree with the uncommitted change on top) has no exact SHA; I logged HEAD before the iteration's own commit, which `ar_check.py` accepts (presence only).
- The skill shows a single `bench.log` as evidence; appending all runs there (prior-loop convention) makes per-iteration attribution rely on run order. Per-iteration log files would be cleaner but break the convention.
- `autoresearch.sh` holding exactly the benchmark command means output capture (`tee`) lives at invocation; worth one line in the skill.

## Blocked / questions
None. Branch `ar/red/ems-stress` is pushed (`e0f5b5c`) and unmerged; the stress-pool build is left to a later task.
