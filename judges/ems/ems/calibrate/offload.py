"""Hospital offload (arrival -> close) by borough and hour (spec §6).

The bundle uses the base-only model. The load-term fits below are kept for the record (task 008 null result).
"""

from __future__ import annotations

from datetime import date, timedelta

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


def fit_offload_base(df: pd.DataFrame) -> dict:
    x = df[df["transported"] & df["offload_s"].notna() & (df["offload_s"] > 0)].copy()
    if "hour" not in x:
        x["hour"] = x["t_hosp"].dt.hour
    base = {}
    for b, g in x.groupby("borough"):
        base[b] = {str(h): quantiles(gh["offload_s"]) for h, gh in g.groupby("hour")}
    return {"model": "base", "base": base}


def offload_inflation_range(df: pd.DataFrame) -> dict:
    """Per-borough range of day-median offload over its trailing 28-day median (spec §9).

    For each borough and day, the ratio is that day's median offload_s over the pooled
    median offload_s of the previous 28 calendar days. A day qualifies only if at least
    20 of those 28 days have transports in the borough. Boroughs with no qualifying
    day are skipped. Quantiles use linear interpolation.
    """
    tr = df[df["transported"] & df["t_hosp"].notna()]
    transport_days = {b: set(gb["day"]) for b, gb in tr.groupby("borough")}
    x = df[df["transported"] & df["offload_s"].notna() & (df["offload_s"] > 0)]
    out = {}
    for b, g in x.groupby("borough"):
        have_days = transport_days.get(b, set())
        by_day = {d: gd["offload_s"].to_numpy(dtype=float) for d, gd in g.groupby("day")}
        ratios = []
        for d in sorted(by_day):
            window = [c for k in range(1, 29) if (c := d - timedelta(k)) in have_days]
            if len(window) < 20:
                continue
            pool = np.concatenate([by_day[c] for c in window if c in by_day])
            if pool.size == 0:
                continue
            ratios.append(float(np.median(by_day[d]) / np.median(pool)))
        if not ratios:
            continue
        r = np.asarray(ratios)
        out[b] = {
            "p50": float(np.quantile(r, 0.50)),
            "p95": float(np.quantile(r, 0.95)),
            "p99": float(np.quantile(r, 0.99)),
            "max": float(r.max()),
            "n_days": len(r),
        }
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


def jan2018_check(df: pd.DataFrame, anchor: dict, fit: dict, tol: float = 0.015) -> dict:
    flu_days = sorted(date.fromisoformat(x) for x in anchor["flu_2018"])
    base_days = {flu_days[0] - timedelta(k) for k in range(1, 29)} - set(flu_days)
    flu_set = set(flu_days)
    x = df[df["transported"] & df["offload_s"].notna() & (df["offload_s"] > 0)].copy()
    x["load"] = prior_load(x, window_s=fit["window_s"])
    out = {}
    for b, g in x.groupby("borough"):
        if b == "UNKNOWN":
            continue
        r = g["load"] / fit["mean_load"][b]
        is_flu = g["day"].isin(flu_set)
        is_base = g["day"].isin(base_days)
        obs = float(g.loc[is_flu, "offload_s"].median() / g.loc[is_base, "offload_s"].median())
        pred = float(np.exp(fit["beta"][b] * (r[is_flu].mean() - r[is_base].mean())))
        out[b] = {"obs": obs, "pred": pred, "ok": bool(abs(pred - obs) <= tol)}
    return out
