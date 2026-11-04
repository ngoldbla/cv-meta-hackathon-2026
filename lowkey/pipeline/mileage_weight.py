"""Fit the used-car mileage weight once (task 057).

w says how far extra miles move a car along its model's age curve:
effective age = age + w * (odometer - 12000 * age) / 12000.

For ages 2, 3 and 4 it reads sold used units (last 90 days) split into
miles below and above typical (two facet calls per age, each over all
models at once), and for every (model, age) cell with at least 10 sales
in both halves computes

    w = (log(P_low / P_high) / |slope|) / ((M_high - M_low) / 12000)

with the model's fitted yearly slope of log(retention). The rule below
was fixed before the fit ran; if it fails, w = 0 (age only).

    set -a; . ~/.config/low-key/env; set +a
    python lowkey/pipeline/mileage_weight.py
"""

from __future__ import annotations

import json
import math
import statistics
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "lowkey" / "preflight"))

ANALYSIS = Path.home() / ".cache" / "low-key" / "preflight" / "analysis.json"
OUT = ROOT / "lowkey" / "app" / "lib" / "mileage-weight.json"
CURRENT_YEAR = 2026
AGES = (2, 3, 4)
TYPICAL = 12_000
MIN_SOLD = 10
RULE = "accept if >= 8 cells, median w in [0.1, 1.5], and the cells' IQR above 0; else w = 0 (age only)"


def cell_weight(p_low, p_high, slope, m_low, m_high) -> float | None:
    if not p_low or not p_high or p_low <= 0 or p_high <= 0 or slope is None or slope >= 0:
        return None
    if m_high <= m_low:
        return None
    years = math.log(p_low / p_high) / abs(slope)
    return years / ((m_high - m_low) / TYPICAL)


def decide(weights: list[float]) -> dict:
    out = {"weight": 0, "accepted": False, "cells": len(weights), "median": None, "iqr": None, "rule": RULE}
    if len(weights) < 8:
        return out
    med = statistics.median(weights)
    q = statistics.quantiles(weights, n=4)
    out.update(median=round(med, 4), iqr=[round(q[0], 4), round(q[2], 4)])
    if 0.1 <= med <= 1.5 and q[0] > 0:
        out.update(weight=round(med, 4), accepted=True)
    return out


def _median_by_model(body: dict) -> dict[str, tuple[int, float | None]]:
    rows = body.get("data", {}).get("facets", {}).get("model") or []
    out = {}
    for r in rows:
        price = (r.get("metrics", {}).get("price.median") or {}).get("value")
        out[r.get("value")] = (int(r.get("count") or 0), float(price) if price is not None else None)
    return out


def main() -> None:
    import provider_client

    analysis = json.loads(ANALYSIS.read_text())
    slopes = {
        model: (entry.get("fit") or {}).get("slope_per_year")
        for models in analysis["models"].values()
        for model, entry in models.items()
    }
    before = provider_client.usage().get("totals")
    weights: list[float] = []
    for age in AGES:
        typ = TYPICAL * age
        halves = {"low": (typ // 2, typ), "high": (typ, typ + typ // 2)}
        got = {}
        for half, (lo, hi) in halves.items():
            got[half] = _median_by_model(
                provider_client.get(
                    "/facets",
                    {
                        "facets": "model",
                        "inventory_status": "sold",
                        "inventory_type": "used",
                        "year": str(CURRENT_YEAR - age),
                        "sold_within_days": "90",
                        "min_mileage": str(lo),
                        "max_mileage": str(hi),
                        "metrics": "price.median",
                        "facet_value_limit": "100",
                    },
                )
            )
        m_low, m_high = (typ // 2 + typ) / 2, (typ + typ + typ // 2) / 2
        for model, (n_low, p_low) in got["low"].items():
            n_high, p_high = got["high"].get(model, (0, None))
            if n_low < MIN_SOLD or n_high < MIN_SOLD:
                continue
            w = cell_weight(p_low, p_high, slopes.get(model), m_low, m_high)
            if w is not None:
                weights.append(w)
    result = decide(weights) | {"asOf": date.today().isoformat()}
    OUT.write_text(json.dumps(result, indent=1) + "\n")
    after = provider_client.usage().get("totals")
    print(json.dumps(result, indent=1))
    print("usage totals before/after:", json.dumps(before), json.dumps(after))


if __name__ == "__main__":
    main()
