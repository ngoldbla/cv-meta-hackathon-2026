"""P8 spot-check for the new #3/#4 picks (task 024, part 3).

For ZIP 60614 only, radius 50 miles: new, in stock, cheapest first
(limit 3), strict gas filter, for the #3 and #4 models of each category
from the four-pick lineups. Records units found (pagination total) and
the lowest price (the cheapest unit's selected price). Prints usage
before/after; the summary JSON stays outside git.
"""

from __future__ import annotations

import json
from pathlib import Path

from provider_client import get, usage

OUT = Path.home() / ".cache" / "low-key" / "preflight" / "p8_four_picks_summary.json"
ZIP_CODE = "60614"
PICKS = [
    ("Sedan", 3, "Mazda3 Sedan"),
    ("Sedan", 4, "Elantra"),
    ("SUV", 3, "CX-50"),
    ("SUV", 4, "4Runner"),
    ("Pickup", 3, "Colorado"),
    ("Pickup", 4, "Silverado 1500"),
]
GAS = {"fuel_type": "Gas only", "exclude_powertrain_type": "MHEV,HEV"}


def search(model: str) -> dict:
    return get(
        "/listings",
        {
            "inventory_type": "new",
            "availability_status": "stock",
            "model": model,
            "postal_code": ZIP_CODE,
            "radius": "50",
            "sort": "price",
            "price_basis": "selected",
            "limit": "3",
            **GAS,
        },
    )


def main() -> None:
    print("usage before:", json.dumps(usage().get("totals", {})), flush=True)
    summary: list[dict] = []
    for category, rank, model in PICKS:
        print(f"{category} #{rank} {model} near {ZIP_CODE} r=50", flush=True)
        body = search(model)
        rows = body.get("data") or []
        cheapest = rows[0] if rows else {}
        entry = {
            "category": category,
            "rank": rank,
            "model": model,
            "zip": ZIP_CODE,
            "radius_mi": 50,
            "units_found": body.get("pagination", {}).get("total"),
            "lowest_price": cheapest.get("selected_price"),
            "lowest_price_with_fees": cheapest.get("price_with_fees"),
        }
        summary.append(entry)
        print(json.dumps(entry), flush=True)
    OUT.write_text(json.dumps(summary, indent=1))
    print("wrote", OUT, flush=True)
    print("usage after:", json.dumps(usage().get("totals", {})), flush=True)


if __name__ == "__main__":
    main()
