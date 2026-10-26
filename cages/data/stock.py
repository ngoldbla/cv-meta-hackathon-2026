"""Real building stock: elevator banks from the NYC DOB "Build Elevator Device Details" registry.

Source: NYC Open Data dataset ``juyv-2jek`` (DOB NOW elevator filings).  Only aggregate statistics
are written to the repository; raw records are fetched at build time.  Caveat: the registry covers
DOB NOW filings (new installs and alterations), so it skews toward recently modernised devices.
"""

from __future__ import annotations

import json
import statistics
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

DATASET = "juyv-2jek"
API = f"https://data.cityofnewyork.us/resource/{DATASET}.json"
FIELDS = [
    "device_type", "elevator_type", "physical_address", "number_of_stops", "elevator_speed_fpm",
    "elevator_capacity_lbs", "destination_dispatch_system", "regenerative_drive",
    "car_to_counterweight_ratio", "travel_from_floor", "travel_to_floor",
]
FPM_TO_MS = 0.00508
LBS_TO_KG = 0.45359237


def fetch(limit: int = 60000, timeout: float = 120.0) -> list[dict]:
    q = urllib.parse.urlencode({"$limit": limit, "$select": ",".join(FIELDS)})
    with urllib.request.urlopen(f"{API}?{q}", timeout=timeout) as r:  # noqa: S310 - fixed https URL
        return json.loads(r.read().decode())


def _num(x):
    try:
        v = float(x)
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


def banks(records: list[dict]) -> list[dict]:
    """Group passenger elevators by address into banks (one bank per address)."""
    by_addr = defaultdict(list)
    for r in records:
        if (r.get("device_type") or "").lower() != "elevator":
            continue
        if (r.get("elevator_type") or "").lower() != "passenger":
            continue
        addr = " ".join((r.get("physical_address") or "").split())
        if addr:
            by_addr[addr].append(r)
    out = []
    for devs in by_addr.values():
        stops = [s for s in (_num(d.get("number_of_stops")) for d in devs) if s]
        speed = [s for s in (_num(d.get("elevator_speed_fpm")) for d in devs) if s]
        cap = [s for s in (_num(d.get("elevator_capacity_lbs")) for d in devs) if s]
        cw = [(_num(d.get("car_to_counterweight_ratio")), _num(d.get("elevator_capacity_lbs"))) for d in devs]
        ob = [a / b for a, b in cw if a and b and 0.2 <= a / b <= 0.7]
        out.append({
            "n_cars": len(devs),
            "stops": max(stops) if stops else None,
            "speed_ms": statistics.median(speed) * FPM_TO_MS if speed else None,
            "capacity_kg": statistics.median(cap) * LBS_TO_KG if cap else None,
            "dcs": any((d.get("destination_dispatch_system") or "").lower() == "yes" for d in devs),
            "regen": any((d.get("regenerative_drive") or "").lower() == "yes" for d in devs),
            "overbalance": statistics.median(ob) if ob else None,
        })
    return out


def _q(xs, qs=(0.1, 0.25, 0.5, 0.75, 0.9)):
    xs = sorted(xs)
    if not xs:
        return {}
    return {f"q{int(q * 100)}": xs[min(len(xs) - 1, int(q * (len(xs) - 1) + 0.5))] for q in qs}


def summarize(bank_list: list[dict], min_stops: int = 20, min_cars: int = 4) -> dict:
    """Aggregate statistics for tall multi-car banks (the venue-tower archetype)."""
    tall = [b for b in bank_list if b["stops"] and b["stops"] >= min_stops and b["n_cars"] >= min_cars]
    return {
        "source": f"NYC Open Data, DOB NOW Build Elevator Device Details ({DATASET})",
        "retrieved_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "n_banks_all": len(bank_list),
        "filter": {"min_stops": min_stops, "min_cars": min_cars},
        "n_banks_tall": len(tall),
        "speed_ms": _q([b["speed_ms"] for b in tall if b["speed_ms"]]),
        "capacity_kg": _q([b["capacity_kg"] for b in tall if b["capacity_kg"]]),
        "n_cars": _q([b["n_cars"] for b in tall]),
        "stops": _q([b["stops"] for b in tall]),
        "overbalance": _q([b["overbalance"] for b in tall if b["overbalance"]]),
        "dcs_share": (sum(b["dcs"] for b in tall) / len(tall)) if tall else None,
        "regen_share": (sum(b["regen"] for b in tall) / len(tall)) if tall else None,
        "samples": [
            {k: b[k] for k in ("n_cars", "stops", "speed_ms", "capacity_kg")}
            for b in tall if b["speed_ms"] and b["capacity_kg"]
        ],
    }


def build(path: str) -> dict:
    s = summarize(banks(fetch()))
    with open(path, "w") as f:
        json.dump(s, f, indent=1)
    return s


if __name__ == "__main__":
    import sys

    out = build(sys.argv[1] if len(sys.argv) > 1 else "stock_summary.json")
    print({k: v for k, v in out.items() if k != "samples"})
