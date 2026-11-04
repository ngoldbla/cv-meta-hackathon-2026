"""P15 gas price data (task 023, part 3).

Pulls every weekly regular-gasoline (product EPMR) area series the
EIA API v2 offers (US, PADDs and sub-PADDs, states, cities) and
builds the ZIP -> most-local-series map: city series first, then
state, then (sub-)PADD, with the US series as final fallback.

ZIP -> state uses the public USPS ZIP3 prefix table below; state ->
PADD uses the EIA's documented PADD membership (PADD 1 split into
its 1A/1B/1C sub-districts, which are more local than PADD 1 as a
whole). Series histories are cached outside git under
~/.cache/low-key/eia/; only counts and coverage are printed.

The EIA key travels as a query parameter, so request URLs are never
printed or logged; HTTP errors report the status code only.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

CACHE = Path.home() / ".cache" / "low-key" / "eia"
OUT = CACHE / "p15_summary.json"
TEST_ZIPS = ("60614", "30097", "59001")

# USPS ZIP3 prefix ranges -> state (public sectional-center table).
# Complete for every assigned prefix (task 040): territories and the
# military AA/AE/AP prefixes included, so "Tax not included: unknown
# state" only appears for a prefix USPS has not assigned.
ZIP3_RANGES: list[tuple[int, int, str]] = [
    (5, 5, "NY"), (6, 7, "PR"), (8, 8, "VI"), (9, 9, "PR"),
    (10, 27, "MA"), (28, 29, "RI"),
    (30, 38, "NH"), (39, 49, "ME"), (50, 54, "VT"), (55, 55, "MA"),
    (56, 59, "VT"), (60, 69, "CT"),
    (70, 89, "NJ"), (90, 98, "AE"), (100, 149, "NY"), (150, 196, "PA"),
    (197, 199, "DE"), (200, 205, "DC"), (206, 219, "MD"),
    (220, 246, "VA"), (247, 268, "WV"), (270, 289, "NC"),
    (290, 299, "SC"), (300, 319, "GA"), (320, 339, "FL"),
    (340, 340, "AA"), (341, 349, "FL"),
    (350, 369, "AL"), (370, 385, "TN"), (386, 397, "MS"),
    (398, 399, "GA"), (400, 427, "KY"), (430, 459, "OH"),
    (460, 479, "IN"), (480, 499, "MI"), (500, 528, "IA"),
    (530, 549, "WI"), (550, 567, "MN"), (569, 569, "DC"),
    (570, 577, "SD"),
    (580, 588, "ND"), (590, 599, "MT"), (600, 629, "IL"),
    (630, 658, "MO"), (660, 679, "KS"), (680, 693, "NE"),
    (700, 714, "LA"), (716, 729, "AR"), (730, 749, "OK"),
    (750, 799, "TX"), (800, 816, "CO"), (820, 831, "WY"),
    (832, 838, "ID"), (840, 847, "UT"), (850, 865, "AZ"),
    (870, 884, "NM"), (885, 885, "TX"), (889, 898, "NV"),
    (900, 961, "CA"), (962, 966, "AP"), (967, 968, "HI"), (969, 969, "GU"),
    (970, 979, "OR"), (980, 994, "WA"), (995, 999, "AK"),
]

# EIA documented PADD membership by state (PADD 1 as sub-districts).
PADD_BY_STATE: dict[str, str] = {
    **dict.fromkeys(["ME", "NH", "VT", "MA", "RI", "CT"], "R1X"),  # 1A
    **dict.fromkeys(["NY", "NJ", "PA", "DE", "MD", "DC"], "R1Y"),  # 1B
    **dict.fromkeys(["VA", "WV", "NC", "SC", "GA", "FL"], "R1Z"),  # 1C
    **dict.fromkeys(
        ["OH", "MI", "IN", "IL", "WI", "MN", "IA", "MO", "KS", "NE",
         "SD", "ND", "KY", "TN", "OK"], "R20"),
    **dict.fromkeys(["TX", "LA", "MS", "AL", "AR", "NM"], "R30"),
    **dict.fromkeys(["CO", "UT", "WY", "MT", "ID"], "R40"),
    **dict.fromkeys(["CA", "OR", "WA", "NV", "AZ", "AK", "HI"], "R50"),
}

# EIA city series -> ZIP3 prefixes of the city itself (most local).
CITY_ZIP3: dict[str, set[int]] = {
    "YBOS": {21, 22},  # Boston
    "YORD": {606},  # Chicago
    "YCLE": {441},  # Cleveland
    "YDEN": {802},  # Denver
    "Y44HO": {770, 772},  # Houston
    "Y05LA": {900, 901, 902},  # Los Angeles
    "YMIA": {331, 332},  # Miami
    "Y35NY": {100, 101, 102, 103, 104, 111, 112, 113, 114, 116},  # NYC
    "Y05SF": {941},  # San Francisco
    "Y48SE": {981},  # Seattle
}
STATE_SERIES = {
    "SCA": "CA", "SCO": "CO", "SFL": "FL", "SMA": "MA", "SMN": "MN",
    "SNY": "NY", "SOH": "OH", "STX": "TX", "SWA": "WA",
}


def zip_to_state(zip_code: str) -> str | None:
    prefix = int(zip_code[:3])
    for lo, hi, state in ZIP3_RANGES:
        if lo <= prefix <= hi:
            return state
    return None


def series_for_zip(zip_code: str) -> tuple[str, str]:
    """Return (duoarea, level): city, state, padd or us for a ZIP."""
    prefix = int(zip_code[:3])
    for duoarea, prefixes in CITY_ZIP3.items():
        if prefix in prefixes:
            return duoarea, "city"
    state = zip_to_state(zip_code)
    if state is not None:
        for duoarea, st in STATE_SERIES.items():
            if st == state:
                return duoarea, "state"
        if state in PADD_BY_STATE:
            return PADD_BY_STATE[state], "padd"
    return "NUS", "us"


def _get(path: str, params: list[tuple[str, str]]) -> dict:
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"https://api.eia.gov{path}?{query}", headers={"User-Agent": "Mozilla/5.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"EIA HTTP {exc.code} on {path} (URL redacted)") from None


def fetch_series(key: str, duoarea: str) -> dict:
    cached = CACHE / f"{duoarea}.json"
    if cached.exists():
        return json.loads(cached.read_text())
    body = _get(
        "/v2/petroleum/pri/gnd/data/",
        [
            ("api_key", key), ("frequency", "weekly"), ("data[0]", "value"),
            ("facets[product][]", "EPMR"), ("facets[duoarea][]", duoarea),
            ("sort[0][column]", "period"), ("sort[0][direction]", "asc"),
            ("offset", "0"), ("length", "5000"),
        ],
    )
    rows = body["response"]["data"]
    record = {
        "duoarea": duoarea,
        "area_name": rows[0]["area-name"] if rows else None,
        "series": rows[0]["series"] if rows else None,
        "periods": [r["period"] for r in rows],
        "values": [float(r["value"]) for r in rows if r.get("value") is not None],
    }
    # Keep values aligned with periods (drop missing values pairwise).
    pairs = [(r["period"], r["value"]) for r in rows if r.get("value") is not None]
    record["periods"] = [p for p, _ in pairs]
    record["values"] = [float(v) for _, v in pairs]
    cached.write_text(json.dumps(record))
    time.sleep(0.25)
    return record


def history_years(record: dict) -> float:
    first = date.fromisoformat(record["periods"][0])
    last = date.fromisoformat(record["periods"][-1])
    return (last - first).days / 365.25


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    key = os.environ["EIA_API_KEY"]
    facet_body = _get("/v2/petroleum/pri/gnd/facet/duoarea/", [("api_key", key)])
    areas = {f["id"]: f["name"] for f in facet_body["response"]["facets"]}
    print(f"duoarea series available: {len(areas)}", flush=True)
    summary: dict = {"areas": {}, "zip_map": {}}
    for duoarea in sorted(areas):
        record = fetch_series(key, duoarea)
        years = history_years(record) if record["periods"] else 0.0
        summary["areas"][duoarea] = {
            "name": areas[duoarea],
            "series": record["series"],
            "n_weeks": len(record["periods"]),
            "first": record["periods"][0] if record["periods"] else None,
            "last": record["periods"][-1] if record["periods"] else None,
            "years": round(years, 1),
        }
        print(
            f"{duoarea:6} {areas[duoarea]:26} n={len(record['periods']):4} "
            f"{summary['areas'][duoarea]['first']}..{summary['areas'][duoarea]['last']} "
            f"({years:.1f}y)",
            flush=True,
        )
    states = sorted(STATE_SERIES[duo] for duo in STATE_SERIES if duo in areas)
    cities = sorted(areas[duo] for duo in CITY_ZIP3 if duo in areas)
    print("states covered directly:", ", ".join(states), flush=True)
    print("cities covered directly:", ", ".join(cities), flush=True)
    for zip_code in TEST_ZIPS:
        duoarea, level = series_for_zip(zip_code)
        entry = summary["areas"].get(duoarea, {})
        ok = entry.get("years", 0) >= 10
        summary["zip_map"][zip_code] = {
            "duoarea": duoarea, "level": level, "years": entry.get("years"),
            "n_weeks": entry.get("n_weeks"), "pass_10y": ok,
        }
        print(f"ZIP {zip_code} -> {duoarea} ({level}) {entry.get('years')}y "
              f"{'PASS' if ok else 'FAIL'}", flush=True)
    summary["states_covered_directly"] = states
    summary["cities_covered_directly"] = cities
    OUT.write_text(json.dumps(summary, indent=1))
    print("wrote", OUT, flush=True)


if __name__ == "__main__":
    main()
