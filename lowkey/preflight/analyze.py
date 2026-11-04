"""Analyse P6 output (task 022, parts 1-4): depth counts, both retention
bases, log-linear retention(age) fits, provisional ranking.

Retention bases per model and age (age = 2026 - model year):
- old: median sold price / median original MSRP (same sold set);
- new: median sold price / median price of new current-model-year units
  of the same model (from the P6 new-2026 facets).

Fit: log(retention_new) = a + b * age, least squares over ages 1-5 with
count >= 30. 5-year retention = exp(a + 5b). Dollars/month of
depreciation over 5 years = new price * (1 - retention5) / 60.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

SRC = Path.home() / ".cache" / "low-key" / "preflight" / "p6_summary.json"
OUT = Path.home() / ".cache" / "low-key" / "preflight" / "analysis.json"
YEARS = [2021, 2022, 2023, 2024, 2025]


def metric(row: dict, name: str) -> float | None:
    value = row.get("metrics", {}).get(name, {}).get("value")
    return float(value) if value is not None else None


def main() -> None:
    data = json.loads(SRC.read_text())
    new_price = {
        cat: {r["value"]: metric(r, "price.median") for r in rows}
        for cat, rows in data["new2026"].items()
    }
    new_msrp = {
        cat: {r["value"]: metric(r, "msrp.median") for r in rows}
        for cat, rows in data["new2026"].items()
    }
    report: dict = {"depth90": {}, "depth180_vs_90_sedan": {}, "models": {}}
    for cat, by_year in data["sold90"].items():
        report["depth90"][cat] = {
            str(y): sum(1 for r in by_year[str(y)] if r["count"] >= 30) for y in YEARS
        }
    for y in YEARS:
        c90 = {r["value"]: r["count"] for r in data["sold90"]["Sedan"][str(y)]}
        c180 = {r["value"]: r["count"] for r in data["sold180_sedan"][str(y)]}
        report["depth180_vs_90_sedan"][str(y)] = {
            "total90": sum(c90.values()),
            "total180": sum(c180.values()),
        }
    for cat, by_year in data["sold90"].items():
        models: dict[str, dict] = {}
        for y in YEARS:
            age = 2026 - y
            for row in by_year[str(y)]:
                name = row["value"]
                price, msrp = metric(row, "price.median"), metric(row, "msrp.median")
                entry = models.setdefault(name, {"ages": {}})
                entry["ages"][str(age)] = {
                    "count": row["count"],
                    "price": price,
                    "msrp": msrp,
                    "ret_old": price / msrp if price and msrp else None,
                    "ret_new": price / new_price[cat][name]
                    if price and new_price[cat].get(name)
                    else None,
                }
        for name, entry in models.items():
            entry["new_price"] = new_price[cat].get(name)
            entry["new_msrp"] = new_msrp[cat].get(name)
            pts = [
                (int(a), v["ret_new"])
                for a, v in entry["ages"].items()
                if v["ret_new"] and v["count"] >= 30
            ]
            if len(pts) >= 3:
                n = len(pts)
                mx = sum(p[0] for p in pts) / n
                my = sum(math.log(p[1]) for p in pts) / n
                b = sum((p[0] - mx) * (math.log(p[1]) - my) for p in pts) / sum(
                    (p[0] - mx) ** 2 for p in pts
                )
                a = my - b * mx
                entry["fit"] = {
                    "n_ages": n,
                    "intercept": a,
                    "slope_per_year": b,
                    "retention_5y": math.exp(a + 5 * b),
                }
                if entry["new_price"]:
                    entry["dep_per_month_5y"] = (
                        entry["new_price"] * (1 - entry["fit"]["retention_5y"]) / 60
                    )
        report["models"][cat] = models
    OUT.write_text(json.dumps(report, indent=1))
    print("wrote", OUT)
    for cat in data["sold90"]:
        print(cat, "models with >=30 per age:", report["depth90"][cat])


if __name__ == "__main__":
    main()
