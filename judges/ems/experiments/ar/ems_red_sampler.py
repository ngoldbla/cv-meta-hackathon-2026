"""Red-loop scenario generator (the red autoresearch loop edits this file only). Starts as the nominal sampler.

Interface (fixed by the frozen red bench and stress-pool builder):
- sample_theta(rng, d) -> theta for calendar date d. It may use only d itself (weekday, month, holiday), never the
  day's calls, because the same function is applied to sealed holdout dates. theta must pass ems.scenarios.bounds.check.
- pick_days(rng, days, n) -> n dates from `days` (dev only; never used for holdout pools).
"""

from __future__ import annotations

from datetime import date

import numpy as np

from ems.scenarios.bounds import check
from ems.scenarios.sampler import sample_theta as nominal_theta


def sample_theta(rng: np.random.Generator, d: date) -> dict:
    t = nominal_theta(rng)
    t["unavailable"] = 0.25
    t["demand"] = 1.0
    t["urgent_share"] = 1.153
    return check(t)


def pick_days(rng: np.random.Generator, days: list[date], n: int) -> list[date]:
    return [days[i] for i in rng.choice(len(days), size=n, replace=n > len(days))]
