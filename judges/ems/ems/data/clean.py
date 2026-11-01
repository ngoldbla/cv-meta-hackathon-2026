"""Typed columns and derived durations from raw 76xm-jjuj rows (strings)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..tiers import TIER_OF_SEVERITY

TIMES = {"t_call": "incident_datetime", "t_assign": "first_assignment_datetime", "t_scene": "first_on_scene_datetime",
         "t_to_hosp": "first_to_hosp_datetime", "t_hosp": "first_hosp_arrival_datetime",
         "t_close": "incident_close_datetime"}


def _secs(a: pd.Series, b: pd.Series) -> pd.Series:
    d = (b - a).dt.total_seconds()
    return d.where(d >= 0)


def clean(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    for new, col in TIMES.items():
        df[new] = pd.to_datetime(df[col], errors="coerce")
    df["sev"] = pd.to_numeric(df["initial_severity_level_code"], errors="coerce").astype("Int64")
    ok = df["sev"].isin(list(TIER_OF_SEVERITY))
    dropped = int((~ok).sum())
    df = df[ok].copy()
    df["tier"] = df["sev"].map(TIER_OF_SEVERITY).astype("Int64")
    df["held"] = df["held_indicator"].eq("Y")
    df["transported"] = df["t_hosp"].notna()
    df["hour"] = df["t_call"].dt.hour
    df["day"] = df["t_call"].dt.date
    num = {k: pd.to_numeric(df[c], errors="coerce").astype(float) for k, c in
           {"dispatch": "dispatch_response_seconds_qy", "resp": "incident_response_seconds_qy",
            "travel": "incident_travel_tm_seconds_qy"}.items()}
    vd, vi = df["valid_dispatch_rspns_time_indc"].eq("Y"), df["valid_incident_rspns_time_indc"].eq("Y")
    df["processing_s"] = num["dispatch"].where(vd & ~df["held"])
    df["response_s"] = num["resp"].where(vi)
    df["travel_s"] = num["travel"].where(vi)
    df["onscene_s"] = _secs(df["t_scene"], df["t_to_hosp"]).where(df["transported"])
    df["transport_s"] = _secs(df["t_to_hosp"], df["t_hosp"]).where(df["transported"])
    df["offload_s"] = _secs(df["t_hosp"], df["t_close"]).where(df["transported"])
    df["nontransport_close_s"] = _secs(df["t_scene"], df["t_close"]).where(~df["transported"])
    out = df.replace({np.inf: np.nan})
    out.attrs["dropped_bad_severity"] = dropped
    return out
