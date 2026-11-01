"""Replayable day tables: one compact array set per calendar day of the calibration window (git-ignored cache)."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from ..data.windows import assert_not_holdout
from .calib import BOROUGHS, Calibration

DAYS = Path(__file__).resolve().parents[2] / "data" / "cache" / "days"


def zip_maps(df: pd.DataFrame, cal: Calibration) -> tuple[dict[str, str], dict[str, dict[str, float]]]:
    """zip -> borough (mode) and, per borough, zip -> share of its calls (zips in the travel matrix only)."""
    x = df[df["borough"].isin(BOROUGHS) & df["zipcode"].isin(cal.zip_index)]
    zb = x.groupby("zipcode")["borough"].agg(lambda s: s.mode().iloc[0]).to_dict()
    w = {}
    for b, g in x.groupby("borough"):
        c = g["zipcode"].value_counts(normalize=True)
        w[b] = {z: float(v) for z, v in c.items()}
    return zb, w


def day_table(df_day: pd.DataFrame, cal: Calibration, zip_borough: dict, home: dict) -> dict[str, np.ndarray]:
    """Arrays for one day: seconds since midnight, zip index, borough index, tier, service group, observed held."""
    top = {b: max(w, key=w.get) for b, w in home.items()}
    x = df_day.copy()
    x["bb"] = x["borough"].where(x["borough"].isin(BOROUGHS), x["zipcode"].map(zip_borough))
    x = x[x["bb"].notna()]
    x["zz"] = x["zipcode"].where(x["zipcode"].isin(cal.zip_index), x["bb"].map(top))
    x = x.sort_values("t_call", kind="stable")
    groups = sorted(cal.service)
    gi = {g: i for i, g in enumerate(groups)}
    g = [gi[cal.group_of(ct, int(tr))] for ct, tr in zip(x["initial_call_type"], x["tier"], strict=True)]
    t0 = pd.to_datetime(x["day"].astype(str))
    return {"t": (x["t_call"] - t0).dt.total_seconds().to_numpy(),
            "z": x["zz"].map(cal.zip_index).to_numpy(dtype=np.int32),
            "b": x["bb"].map({b: i for i, b in enumerate(BOROUGHS)}).to_numpy(dtype=np.int8),
            "tier": x["tier"].to_numpy(dtype=np.int8), "g": np.array(g, dtype=np.int16),
            "held_obs": x["held"].to_numpy(dtype=bool)}


def write_days(df: pd.DataFrame, cal: Calibration, zip_borough: dict, home: dict, out: Path = DAYS) -> int:
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    for d, g in df.groupby("day"):
        np.savez_compressed(out / f"{d.isoformat()}.npz", **day_table(g, cal, zip_borough, home))
        n += 1
    return n


def load_day(d: date, path: Path = DAYS) -> dict[str, np.ndarray]:
    assert_not_holdout(d, d)
    with np.load(path / f"{d.isoformat()}.npz") as f:
        return {k: f[k] for k in f.files}
