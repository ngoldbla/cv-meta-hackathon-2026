"""Frozen perturbation bounds (spec §9), measured from pre-2020 data only (2005-2015 and 2017-2019; 2016 excluded).

- demand: daily calls over the trailing-28-day mean, 0.808..1.413 (max 2012-01-01; bounds_daily.csv); floor 0.9.
- urgent_share: share of severity 1-3 calls over its median, 0.765..1.153 (bounds_daily.csv).
- offload: daily borough offload median over its trailing-28-day median, max 1.151 (offload_inflation.json).
- unavailable: 1 - median(p10 / median) of busy units at held onsets, 0.25 (fleet.json).
- concentration_calls: largest single-zip daily excess over its trailing-28-day mean, 104 (2017-2019 day tables),
  spread over at most 3 zips.
- combined load: demand / (1 - unavailable) <= 1.413, the worst pre-2020 demand surge, so combinations never
  exceed a load that NYC actually met (Dylan, 2026-11-01). Draws above it are rejected, never clipped.
"""

from __future__ import annotations

BOUNDS = {"demand": (0.9, 1.413), "urgent_share": (0.765, 1.153), "offload": (1.0, 1.151), "unavailable": (0.0, 0.25),
          "concentration_calls": (0.0, 104.0), "concentration_zips": (0.0, 3.0)}
LOAD_CAP = 1.413


def check(theta: dict) -> dict:
    """Return theta unchanged, or raise ValueError for an unknown key or a value outside its bounds (never clip)."""
    for k, v in theta.items():
        if k not in BOUNDS:
            raise ValueError(f"unknown theta key {k!r}")
        lo, hi = BOUNDS[k]
        if not lo <= float(v) <= hi:
            raise ValueError(f"theta[{k!r}] = {v} outside [{lo}, {hi}]")
    load = float(theta.get("demand", 1.0)) / (1.0 - float(theta.get("unavailable", 0.0)))
    if load > LOAD_CAP:
        raise ValueError(f"combined load {load:.3f} > {LOAD_CAP}")
    return theta
