"""Travel inputs (spec §6): observed travel-time targets, zip centroids, and an OSRM driving-time matrix.

The hour-of-day scale on the OSRM matrix is fitted later by simulation (M3c), against travel_targets.
"""

from __future__ import annotations

import csv
import io
import json
from urllib.request import urlopen

import numpy as np
import pandas as pd

from .service import quantiles


def travel_targets(df: pd.DataFrame) -> dict:
    out = {}
    for (b, h), g in df[df["travel_s"].notna()].groupby(["borough", "hour"]):
        out.setdefault(b, {})[str(int(h))] = quantiles(g["travel_s"])
    return out


def zip_centroids(gazetteer_txt: str, zips: set[str]) -> dict[str, tuple[float, float]]:
    rows = csv.DictReader(io.StringIO(gazetteer_txt), delimiter="\t")
    out = {}
    for r in rows:
        r = {k.strip(): v.strip() for k, v in r.items()}
        if r["GEOID"] in zips:
            out[r["GEOID"]] = (float(r["INTPTLAT"]), float(r["INTPTLONG"]))
    return out


def osrm_table(points: list[tuple[float, float]], base: str = "http://127.0.0.1:5005", opener=urlopen) -> np.ndarray:
    coords = ";".join(f"{lon},{lat}" for lat, lon in points)
    with opener(f"{base}/table/v1/driving/{coords}?annotations=duration", timeout=600) as resp:
        data = json.load(resp)
    if data.get("code") != "Ok":
        raise RuntimeError(f"OSRM: {data.get('code')} {data.get('message', '')}")
    return np.asarray(data["durations"], dtype=float)
