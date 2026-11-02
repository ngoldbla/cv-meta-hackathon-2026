"""Red-loop scenario generator (the red autoresearch loop edits this file only). Starts as the nominal sampler.

Interface (fixed by the frozen red bench and stress-pool builder):
- sample_theta(rng, d) -> theta for calendar date d. It may use only d itself (weekday, month, holiday), never the
  day's calls, because the same function is applied to sealed holdout dates. theta must pass ems.scenarios.bounds.check.
- pick_days(rng, days, n) -> n dates from `days` (dev only; never used for holdout pools).

Red it1: demand fixed at its floor (0.9); the red baseline showed regret
falling as demand rose (corr -0.25), so low-demand days may widen the
b1-vs-oracle gap the regret metric scores.
(Red it2/it3 reverted: urgent ceiling 516.20, unavailable ceiling 579.82.)
Red it4: concentration maxed (104 calls over 3 zips); spatial spikes should
reward the oracle's foresight positioning over b1's static map.
"""

from __future__ import annotations

from datetime import date

import numpy as np

from ems.scenarios.sampler import sample_theta as nominal_theta


def sample_theta(rng: np.random.Generator, d: date) -> dict:
    t = nominal_theta(rng)
    t["demand"] = 0.9
    t["concentration_calls"] = 104.0
    t["concentration_zips"] = 3.0
    return t


def pick_days(rng: np.random.Generator, days: list[date], n: int) -> list[date]:
    return [days[i] for i in rng.choice(len(days), size=n, replace=n > len(days))]
