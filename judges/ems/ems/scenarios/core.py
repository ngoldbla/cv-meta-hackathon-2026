"""Frozen scenario mechanics: the dev-day set and how theta changes a day table (spec §9).

The red loop edits only `sampler.py` (which days, which theta); it cannot change what a perturbation does,
which days count as dev, or the bounds, because this file and `bounds.py` are frozen.
"""

from __future__ import annotations

import json
from datetime import date
from functools import lru_cache

import numpy as np

from ..sim.calib import CAL
from ..sim.trace import DAYS
from .bounds import check

FIRST, LAST = date(2017, 1, 1), date(2019, 12, 31)  # the calibration window (spec §5)


@lru_cache(maxsize=1)
def _dev_days() -> tuple[date, ...]:
    anchor = json.loads((CAL / "anchor_days.json").read_text())
    excluded = {date.fromisoformat(x) for x in anchor["normal_2019"] + anchor["flu_2018"]}
    cached = (date.fromisoformat(p.stem) for p in sorted(DAYS.glob("*.npz")))
    return tuple(d for d in cached if FIRST <= d <= LAST and d not in excluded)


def dev_days() -> list[date]:
    """Cached days inside the 2017-2019 calibration window, minus the 68 anchor days."""
    return list(_dev_days())


def is_dev_day(d: date) -> bool:
    return d in set(_dev_days())


def perturb(day: dict, theta: dict, seed: int, zip_b: np.ndarray, tier_group: dict[int, int]) -> dict:
    """Apply demand, urgent-share and concentration perturbations to a day table (offload and unavailability go to the sim)."""
    check(theta)
    rng = np.random.default_rng([seed, 11, len(day["t"])])
    t, z, b, tier, g, ho = (day[k].copy() for k in ("t", "z", "b", "tier", "g", "held_obs"))
    m = float(theta.get("demand", 1.0))
    if m < 1.0:
        keep = rng.random(len(t)) < m
        t, z, b, tier, g, ho = (a[keep] for a in (t, z, b, tier, g, ho))
    elif m > 1.0:
        extra = rng.random(len(t)) < (m - 1.0)
        jitter = rng.uniform(-900, 900, extra.sum())
        t = np.concatenate([t, np.clip(t[extra] + jitter, 0, 86399)])
        z, b, tier, g, ho = (np.concatenate([a, a[extra]]) for a in (z, b, tier, g, ho))
    a = float(theta.get("urgent_share", 1.0))
    urgent = tier <= 2
    share = urgent.mean() if len(tier) else 0.0
    if a > 1.0 and share > 0:
        p = min(1.0, (a - 1.0) * share / max(1e-9, 1 - share))
        flip = (~urgent) & (rng.random(len(tier)) < p)
        tier, g = tier.copy(), g.copy()
        tier[flip], g[flip] = 2, tier_group[2]
    elif a < 1.0 and share > 0:
        flip = (tier == 2) & (rng.random(len(tier)) < (1.0 - a))
        tier, g = tier.copy(), g.copy()
        tier[flip], g[flip] = 3, tier_group[3]
    k, c = int(theta.get("concentration_zips", 0)), int(round(theta.get("concentration_calls", 0)))
    if k > 0 and c > 0 and len(t):
        zs = rng.choice(len(zip_b), size=k, replace=False)
        ct = np.sort(rng.uniform(0, 86399, c))
        cz = zs[rng.integers(0, k, c)]
        src = rng.integers(0, len(t), c)
        t = np.concatenate([t, ct])
        z = np.concatenate([z, cz])
        b = np.concatenate([b, zip_b[cz].astype(b.dtype)])
        tier, g = (np.concatenate([arr, arr[src]]) for arr in (tier, g))
        ho = np.concatenate([ho, np.zeros(c, dtype=bool)])
    order = np.argsort(t, kind="stable")
    return {"t": t[order], "z": z[order].astype(np.int32), "b": b[order], "tier": tier[order], "g": g[order],
            "held_obs": ho[order]}
