"""Build the replay day tables and the zip maps from the 2017-2019 calibration cache.

    python -m ems.sim.build        # writes data/cache/days/*.npz (git-ignored) and calibration/sim_inputs.json
"""

from __future__ import annotations

import json
import sys

import numpy as np
import pandas as pd

from ..calibrate.fleet import concurrency_at, held_onsets
from ..data.clean import clean
from ..data.store import load
from .calib import BOROUGHS, CAL, Calibration
from .trace import DAYS, write_days, zip_maps


def hourly_calls(fit: pd.DataFrame) -> dict:
    days = fit["day"].nunique()
    return {b: {str(h): float(n / days) for h, n in g.groupby("hour").size().items()}
            for b, g in fit[fit["borough"].isin(BOROUGHS)].groupby("borough")}


def fleet_elasticity(fit: pd.DataFrame, fleet: dict, hourly: dict) -> dict:
    """Per borough: slope of log(busy units at held onset / median for that hour) on log(trailing-3h demand ratio)."""
    out = {}
    for b in BOROUGHS:
        g = fit[fit["borough"] == b]
        ok = g["t_assign"].notna() & g["t_close"].notna() & (g["t_close"] > g["t_assign"])
        ons = held_onsets(g)
        if len(ons) < 50:
            out[b] = 0.0
            continue
        c = concurrency_at(g.loc[ok, "t_assign"].astype("int64").to_numpy(), g.loc[ok, "t_close"].astype("int64").to_numpy(),
                           ons["t_call"].astype("int64").to_numpy())
        t_all = np.sort(g["t_call"].astype("int64").to_numpy())
        t_on = ons["t_call"].astype("int64").to_numpy()
        trail = np.searchsorted(t_all, t_on, side="left") - np.searchsorted(t_all, t_on - 3 * 3600 * 10**9, side="left")
        h = ons["t_call"].dt.hour.to_numpy()
        exp3 = np.array([sum(hourly.get(b, {}).get(str((hh - k) % 24), 0.0) for k in range(1, 4)) for hh in h])
        med = np.array([fleet[b][str(hh)]["median"] for hh in h])
        m = (c > 0) & (exp3 > 0) & (trail > 0)
        x, y = np.log(trail[m] / exp3[m]), np.log(c[m] / med[m])
        out[b] = float(np.clip((x * y).sum() / (x * x).sum(), 0.0, 1.0)) if (x * x).sum() > 0 else 0.0
    return out


def tier_travel_targets(fit: pd.DataFrame) -> dict:
    return {str(int(t)): {"p50": float(g["travel_s"].median()), "p90": float(g["travel_s"].quantile(0.9))}
            for t, g in fit[fit["travel_s"].notna()].groupby("tier")}


def main() -> int:
    cal = Calibration.load()
    df = pd.concat([clean(load(f"calib-{y}")) for y in (2017, 2018, 2019)], ignore_index=True)
    anchor = json.loads((CAL / "anchor_days.json").read_text())
    excluded = {pd.Timestamp(x).date() for x in anchor["normal_2019"] + anchor["flu_2018"]}
    fit = df[~df["day"].isin(excluded)]
    zb, home = zip_maps(fit, cal)
    n = write_days(df, cal, zb, home, DAYS)
    hourly = hourly_calls(fit)
    path = CAL / "sim_inputs.json"
    inputs = json.loads(path.read_text()) if path.exists() else {}
    inputs.update({"zip_borough": zb, "home_weights": home, "hourly_calls": hourly,
                   "fleet_elasticity": fleet_elasticity(fit, cal.fleet, hourly),
                   "tier_travel_targets": tier_travel_targets(fit)})
    path.write_text(json.dumps(inputs, indent=1, sort_keys=True) + "\n")
    print(json.dumps({"days": n, "zips": len(zb), "fleet_elasticity": inputs["fleet_elasticity"],
                      "tier_travel_targets": inputs["tier_travel_targets"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
