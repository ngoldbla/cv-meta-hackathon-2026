"""Hospital offload (arrival -> close) by borough and hour, with a fitted load term (spec §6)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .service import quantiles


def prior_load(df: pd.DataFrame, window_s: int = 7200) -> pd.Series:
    out = pd.Series(0, index=df.index, dtype=int)
    tr = df[df["transported"] & df["t_hosp"].notna()]
    for _, g in tr.groupby("borough"):
        t = g["t_hosp"].astype("int64").to_numpy() // 10**9
        order = np.argsort(t, kind="stable")
        ts = t[order]
        lo = np.searchsorted(ts, ts - window_s, side="left")
        cnt = np.arange(len(ts)) - lo
        out.loc[g.index[order]] = cnt
    return out


def fit_offload_ratio(df: pd.DataFrame, window_s: int = 86400) -> dict:
    x = df[df["transported"] & df["offload_s"].notna() & (df["offload_s"] > 0)].copy()
    x["load"] = prior_load(x, window_s=window_s)
    if "hour" not in x:
        x["hour"] = x["t_hosp"].dt.hour
    base, mean_load, beta = {}, {}, {}
    for b, g in x.groupby("borough"):
        base[b] = {str(h): quantiles(gh["offload_s"]) for h, gh in g.groupby("hour")}
        pos = g.loc[g["load"] > 0, "load"]
        ml = float(pos.mean()) if len(pos) else 0.0
        mean_load[b] = ml
        med = g.groupby("hour")["offload_s"].transform("median")
        y = np.log(g["offload_s"].to_numpy()) - np.log(med.to_numpy())
        z = (g["load"].to_numpy() / ml - 1.0) if ml > 0 else np.zeros(len(g))
        beta[b] = float((z * y).sum() / (z * z).sum()) if (z * z).sum() > 0 else 0.0
    return {"model": "ratio24", "window_s": window_s, "base": base, "mean_load": mean_load, "beta": beta}


def fit_offload(df: pd.DataFrame) -> dict:
    x = df[df["transported"] & df["offload_s"].notna() & (df["offload_s"] > 0)].copy()
    x["load"] = prior_load(x)
    if "hour" not in x:
        x["hour"] = x["t_hosp"].dt.hour
    base, mean_load, beta = {}, {}, {}
    for b, g in x.groupby("borough"):
        base[b] = {str(h): quantiles(gh["offload_s"]) for h, gh in g.groupby("hour")}
        mean_load[b] = {str(h): float(gh["load"].mean()) for h, gh in g.groupby("hour")}
        med = g.groupby("hour")["offload_s"].transform("median")
        ml = g.groupby("hour")["load"].transform("mean")
        y, z = np.log(g["offload_s"]) - np.log(med), g["load"] - ml
        beta[b] = float((z * y).sum() / (z * z).sum()) if (z * z).sum() > 0 else 0.0
    return {"base": base, "mean_load": mean_load, "beta": beta, "window_s": 7200}
