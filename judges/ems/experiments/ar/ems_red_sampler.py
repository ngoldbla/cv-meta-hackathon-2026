"""Red-loop scenario generator (the red autoresearch loop edits this file only). Starts as the nominal sampler.

Interface (fixed by the frozen red bench and stress-pool builder):
- sample_theta(rng, d) -> theta for calendar date d. It may use only d itself (weekday, month, holiday), never the
  day's calls, because the same function is applied to sealed holdout dates. theta must pass ems.scenarios.bounds.check.
- pick_days(rng, days, n) -> n dates from `days` (dev only; never used for holdout pools).
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import numpy as np

from ems.scenarios.bounds import LOAD_CAP, check
from ems.scenarios.sampler import sample_theta as nominal_theta


def sample_theta(rng: np.random.Generator, d: date) -> dict:
    t = nominal_theta(rng)
    t["unavailable"] = 0.25
    t["urgent_share"] = 1.153
    t["demand"] = LOAD_CAP * (1.0 - t["unavailable"]) - 1e-6
    t["offload"] = 1.151
    t["concentration_calls"] = 104.0
    t["concentration_zips"] = 3.0
    return check(t)


def pick_days(rng: np.random.Generator, days: list[date], n: int) -> list[date]:
    lib = Path(__file__).resolve().parents[4] / "research/autoresearch/ems-full-red/library/regret_days.json"
    avail = set(days)
    ranked = [d for d in (date.fromisoformat(x) for x in json.loads(lib.read_text())["dates"]) if d in avail]
    if len(ranked) >= n:
        return ranked[:n]
    return ranked + [days[i] for i in rng.choice(len(days), size=n - len(ranked), replace=True)]
