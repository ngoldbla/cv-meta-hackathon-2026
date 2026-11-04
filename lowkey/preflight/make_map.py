"""Resolve provider model -> make for current new inventory (task 023).

The provider's model values do not carry their make ("Accord Sedan",
and bare "1500"/"2500"/"3500" for one maker's trucks). The lineup
brand rule needs the make of every rankable model, so for each
category this reads the make facet list, then the model facet list
filtered by each make, and joins them. A single facets=make,model
call returns the two lists separately, not paired, so the per-make
calls are the cheap way to get pairs (about $0.003 each, paced and
cached by provider_client).

Writes ~/.cache/low-key/preflight/make_map.json (outside git) and
prints usage before/after. Raw responses stay in the client cache,
never in git.
"""

from __future__ import annotations

import json
from pathlib import Path

from categories import CATEGORIES, filters
from provider_client import get, usage

OUT = Path.home() / ".cache" / "low-key" / "preflight" / "make_map.json"


def facet_values(category: str, facet: str, **extra: str) -> list[str]:
    body = get(
        "/facets",
        {
            "facets": facet,
            "inventory_type": "new",
            **filters(category),
            "year": "2026",
            "facet_value_limit": "80",
            **extra,
        },
    )
    return [row["value"] for row in body["data"]["facets"][facet]]


def main() -> None:
    print("usage before:", json.dumps(usage().get("totals", {})), flush=True)
    mapping: dict[str, dict[str, str]] = {}
    for category in CATEGORIES:
        makes = facet_values(category, "make")
        print(f"{category}: {len(makes)} makes", flush=True)
        pairs: dict[str, str] = {}
        for make in makes:
            for model in facet_values(category, "model", make=make):
                previous = pairs.setdefault(model, make)
                if previous != make:
                    print(f"  note: {model!r} under both {previous} and {make}", flush=True)
        mapping[category] = pairs
        print(f"{category}: {len(pairs)} models mapped", flush=True)
    OUT.write_text(json.dumps(mapping, indent=1, sort_keys=True))
    print("wrote", OUT, flush=True)
    print("usage after:", json.dumps(usage().get("totals", {})), flush=True)


if __name__ == "__main__":
    main()
