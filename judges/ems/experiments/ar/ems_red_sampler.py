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
    if d.weekday() >= 5 or _federal_holiday(d):
        t["demand"] = LOAD_CAP * 0.75 - 1e-6
    t["urgent_share"] = 1.153
    return check(t)


def pick_days(rng: np.random.Generator, days: list[date], n: int) -> list[date]:
    return [days[i] for i in rng.choice(len(days), size=n, replace=n > len(days))]
