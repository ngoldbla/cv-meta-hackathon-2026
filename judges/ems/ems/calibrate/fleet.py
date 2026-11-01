"""Fleet in service, inferred from busy-unit concurrency at held-call onsets (spec §6).

When a call is held, every unit is busy, so the number of incidents between first assignment and close
at that moment estimates the units in service.  (First-unit intervals only: multi-unit incidents are
undercounted, which the fit report states.)
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def concurrency_at(starts, ends, t) -> np.ndarray:
    s, e = np.sort(np.asarray(starts)), np.sort(np.asarray(ends))
    return np.searchsorted(s, t, side="right") - np.searchsorted(e, t, side="right")


def held_onsets(df: pd.DataFrame, gap_s: int = 1800) -> pd.DataFrame:
    h = df[df["held"]].sort_values("t_call")
    prev = h.groupby("borough")["t_call"].shift(1)
    return h[(prev.isna()) | ((h["t_call"] - prev).dt.total_seconds() > gap_s)]


def fit_fleet(df: pd.DataFrame) -> dict:
    ok = df["t_assign"].notna() & df["t_close"].notna() & (df["t_close"] > df["t_assign"])
    ons = held_onsets(df)
    out = {}
    for b, g in df[ok].groupby("borough"):
        s = g["t_assign"].astype("int64").to_numpy()
        e = g["t_close"].astype("int64").to_numpy()
        ob = ons[ons["borough"] == b]
        c = concurrency_at(s, e, ob["t_call"].astype("int64").to_numpy())
        hours = ob["t_call"].dt.hour.to_numpy()
        out[b] = {str(h): {"median": float(np.median(c[hours == h])), "p10": float(np.percentile(c[hours == h], 10)),
                           "p90": float(np.percentile(c[hours == h], 90)), "n_onsets": int((hours == h).sum())}
                  for h in sorted(set(hours.tolist()))}
    return out
