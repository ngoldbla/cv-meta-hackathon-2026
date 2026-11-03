"""P8 local price search (task 022, part 5).

For ZIPs 60614 (dense), 30097 (suburban), 59001 (rural) and the top
model per category (Accord Sedan, CR-V, Tacoma): new, in stock,
radius 50, cheapest first, limit 3, strict gas filter. If fewer than
3 units at 50 miles, retry at 150 and record that the widening was
needed. Prints usage before/after; summary JSON stays outside git.
"""

from __future__ import annotations

import json
from pathlib import Path

from provider_client import get, usage

OUT = Path.home() / ".cache" / "low-key" / "preflight" / "p8_summary.json"
ZIPS = ["60614", "30097", "59001"]
MODELS = {"Sedan": "Accord Sedan", "SUV": "CR-V", "Pickup": "Tacoma"}
GAS = {"fuel_type": "Gas only", "exclude_powertrain_type": "MHEV,HEV"}


def search(model: str, zip_code: str, radius: int) -> dict:
    return get(
        "/listings",
        {
            "inventory_type": "new",
            "availability_status": "stock",
            "model": model,
            "postal_code": zip_code,
            "radius": str(radius),
            "sort": "price",
            "price_basis": "selected",
            "limit": "3",
            **GAS,
        },
    )


def main() -> None:
    print("usage before:", json.dumps(usage().get("totals", {})), flush=True)
    summary: dict = {}
    for category, model in MODELS.items():
        for zip_code in ZIPS:
            print(f"{model} near {zip_code} r=50", flush=True)
            body = search(model, zip_code, 50)
            total = body.get("pagination", {}).get("total")
            entry = {"total_50mi": total, "widened": False}
            if total is not None and total < 3:
                print(f"{model} near {zip_code} r=150", flush=True)
                wide = search(model, zip_code, 150)
                entry["widened"] = True
                entry["total_150mi"] = wide.get("pagination", {}).get("total")
            summary[f"{category}:{zip_code}"] = entry
    OUT.write_text(json.dumps(summary, indent=1))
    print(json.dumps(summary, indent=1), flush=True)
    print("usage after:", json.dumps(usage().get("totals", {})), flush=True)


if __name__ == "__main__":
    main()
