"""Anchor days (excluded from every fit) and the observed anchor targets (spec §7)."""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd


def select_anchor_days(daily: pd.DataFrame) -> dict:
    d = daily.sort_values("day").reset_index(drop=True)
    d["trail"] = d["n"].shift(1).rolling(28, min_periods=28).mean()
    jan = d[(pd.to_datetime(d["day"]) >= "2018-01-01") & (pd.to_datetime(d["day"]) <= "2018-01-31")].copy()
    jan["ratio"] = jan["n"] / jan["trail"]
    flu = sorted(x.isoformat() for x in jan.nlargest(7, "ratio")["day"])
    normal = [x.isoformat() for x in d["day"] if x.year == 2019 and x.toordinal() % 6 == 0]
    return {"normal_2019": normal, "flu_2018": flu}


def fit_days(all_days: set, anchor: dict) -> set:
    excluded = {date.fromisoformat(x) for x in anchor["normal_2019"] + anchor["flu_2018"]}
    return {d for d in all_days if d not in excluded}


def anchor_targets(df: pd.DataFrame, anchor: dict) -> dict:
    normal = df[df["day"].isin({date.fromisoformat(x) for x in anchor["normal_2019"]})]
    tiers = {}
    for t, g in normal.groupby("tier"):
        r = g["response_s"].dropna() / 60
        tiers[str(int(t))] = {"p50_min": float(np.percentile(r, 50)), "p90_min": float(np.percentile(r, 90))}
    flu_days = sorted(date.fromisoformat(x) for x in anchor["flu_2018"])
    before = {flu_days[0] - timedelta(k) for k in range(1, 29)} - set(flu_days)
    share = df.groupby("day")["held"].mean()
    return {
        "normal": {"tiers": tiers, "held_share": float(normal["held"].mean()),
                   "transports_per_day": float(normal.groupby("day")["transported"].sum().mean()),
                   "offload_median_min": float(normal["offload_s"].dropna().median() / 60)},
        "flu": {"held_share_increase": float(share[share.index.isin(flu_days)].mean()
                                             - share[share.index.isin(before)].mean())},
    }
