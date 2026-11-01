"""Empirical service-time distributions as 101-point quantile tables per call-type group (spec §6)."""

from __future__ import annotations

import numpy as np
import pandas as pd

Q = np.linspace(0, 100, 101)


def quantiles(x, q: int = 101) -> list[float]:
    # Linear interpolation at linspace(0, n - 1, q), knot-exact (np.percentile's
    # q / 100 * (n - 1) positions round to e.g. 7.000000000000001 on numpy 2.5.4).
    a = np.sort(np.asarray(pd.Series(x, dtype=float).dropna()))
    if a.size == 0:
        return []
    if a.size == 1:
        return [float(a[0])] * q
    pos = np.linspace(0, a.size - 1, q)
    lo = pos.astype(int)
    hi = np.minimum(lo + 1, a.size - 1)
    return [float(v) for v in a[lo] + (a[hi] - a[lo]) * (pos - lo)]


def call_type_groups(df: pd.DataFrame, min_n: int = 2000) -> dict[str, str]:
    counts = df.groupby("initial_call_type").size()
    tier_of = df.groupby("initial_call_type")["tier"].agg(lambda s: int(s.mode().iloc[0]))
    return {ct: (ct if counts[ct] >= min_n else f"tier{tier_of[ct]}-other") for ct in counts.index}


def service_tables(df: pd.DataFrame, groups: dict[str, str]) -> dict[str, dict]:
    g = df.assign(group=df["initial_call_type"].map(groups))
    out = {}
    for name, x in g.groupby("group"):
        out[name] = {"n": int(len(x)), "tier": int(x["tier"].mode().iloc[0]),
                     "processing_q": quantiles(x["processing_s"]), "onscene_q": quantiles(x["onscene_s"]),
                     "p_transport": float(x["transported"].mean()), "transport_q": quantiles(x["transport_s"]),
                     "nontransport_close_q": quantiles(x["nontransport_close_s"])}
    return out
