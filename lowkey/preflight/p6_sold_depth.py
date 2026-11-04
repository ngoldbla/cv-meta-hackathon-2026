"""P6 sold depth + new-price basis (task 022, parts 1-2).

Sold: for each category (categories.py; task 042 added Minivan,
Hybrid and Electric) and model year 2021-2025,
facets=model on sold used inventory, the category filter, sold_within_days=90,
max_mileage=(2026-year)*15000+8000. One category (Sedan) is repeated at
sold_within_days=180 to see how far back sold history reaches.

New basis: facets=model on new current-model-year (2026) inventory per
category with the category filter, for retention vs today's new price.

Writes a single summary JSON outside git; prints usage before/after.
"""

from __future__ import annotations

import json
from pathlib import Path

from categories import CATEGORIES, filters
from provider_client import get, usage

OUT = Path.home() / ".cache" / "low-key" / "preflight" / "p6_summary.json"
YEARS = [2021, 2022, 2023, 2024, 2025]
METRICS = "price.median,msrp.median,miles.median"


def sold_facets(category: str, year: int, days: int) -> list[dict]:
    body = get(
        "/facets",
        {
            "facets": "model",
            "inventory_status": "sold",
            "inventory_type": "used",
            **filters(category),
            "year": str(year),
            "sold_within_days": str(days),
            "max_mileage": str((2026 - year) * 15000 + 8000),
            "metrics": METRICS,
            "facet_value_limit": "80",
        },
    )
    return body["data"]["facets"]["model"]


def new_facets(category: str, year: int) -> list[dict]:
    body = get(
        "/facets",
        {
            "facets": "model",
            "inventory_type": "new",
            **filters(category),
            "year": str(year),
            "metrics": "price.median,msrp.median",
            "facet_value_limit": "80",
        },
    )
    return body["data"]["facets"]["model"]


def main() -> None:
    print("usage before:", json.dumps(usage().get("totals", {})), flush=True)
    summary: dict = {"sold90": {}, "sold180_sedan": {}, "new2026": {}}
    for category in CATEGORIES:
        summary["sold90"][category] = {}
        for year in YEARS:
            print(f"sold90 {category} {year}", flush=True)
            summary["sold90"][category][str(year)] = sold_facets(category, year, 90)
    for year in YEARS:
        print(f"sold180 Sedan {year}", flush=True)
        summary["sold180_sedan"][str(year)] = sold_facets("Sedan", year, 180)
    for category in CATEGORIES:
        print(f"new2026 {category}", flush=True)
        summary["new2026"][category] = new_facets(category, 2026)
    OUT.write_text(json.dumps(summary, indent=1))
    print("wrote", OUT, flush=True)
    print("usage after:", json.dumps(usage().get("totals", {})), flush=True)


if __name__ == "__main__":
    main()
