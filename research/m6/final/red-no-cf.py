"""Red-loop scenario generator (the red autoresearch loop edits this file only). Starts as the nominal sampler.

Interface (fixed by the frozen red bench and stress-pool builder):
- sample_theta(rng, d) -> theta for calendar date d. It may use only d itself (weekday, month, holiday), never the
  day's calls, because the same function is applied to sealed holdout dates. theta must pass ems.scenarios.bounds.check.
- pick_days(rng, days, n) -> n dates from `days` (dev only; never used for holdout pools).
"""

from __future__ import annotations

from datetime import date

import numpy as np


def sample_theta(rng: np.random.Generator, d: date) -> dict:
    # Concentrated surge: maximum urgent share with maximum spatial concentration.
    return {"demand": 1.1, "urgent_share": 1.153, "offload": 1.05, "unavailable": 0.0,
            "concentration_calls": 104.0, "concentration_zips": 3.0}


def pick_days(rng: np.random.Generator, days: list[date], n: int) -> list[date]:
    return [days[i] for i in rng.choice(len(days), size=n, replace=n > len(days))]
