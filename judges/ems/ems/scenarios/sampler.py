"""Scenario sampler: which dev days and which theta (the red loop may edit this file only).

The mechanics (dev-day set, perturbation) are frozen in `core.py`; the bounds in `bounds.py`.
"""

from __future__ import annotations

from datetime import date

import numpy as np

from .bounds import BOUNDS, LOAD_CAP, check
from .core import dev_days


def sample_theta(rng: np.random.Generator) -> dict:
    """Uniform within the bounds, rejecting draws whose combined load exceeds LOAD_CAP."""
    while True:
        t = {k: float(rng.uniform(lo, hi)) for k, (lo, hi) in BOUNDS.items() if k not in ("concentration_zips",)}
        t["concentration_zips"] = float(rng.integers(0, 4))
        if t["concentration_zips"] == 0:
            t["concentration_calls"] = 0.0
        if t["demand"] / (1.0 - t["unavailable"]) <= LOAD_CAP:
            return check(t)


def dev_pool(n: int, seed: int = 0) -> list[tuple[date, dict, int]]:
    rng = np.random.default_rng([seed, 7])
    days = dev_days()
    picks = rng.choice(len(days), size=n, replace=n > len(days))
    return [(days[i], sample_theta(rng), int(seed)) for i in picks]
