"""Real transit stock: the 7 line (Flushing) from MTA open data.

Sources:
- the MTA subway GTFS static feed (https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip): station order,
  positions along the track, scheduled stop-to-stop times and headways by hour;
- MTA Subway Hourly Ridership (data.ny.gov ``wujg-7c2s``): mean hourly entries per station complex.

Only aggregates are written to the repository (``cages/data/mta_7line.json``), with the feed version, the
download's SHA-256 and the exact ridership query, so the summary can be rebuilt and checked.

    python -m cages.data.stock --out cages/data/mta_7line.json
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import statistics
import urllib.parse
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

GTFS_URL = "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip"
RIDERSHIP = "wujg-7c2s"
RIDERSHIP_API = f"https://data.ny.gov/resource/{RIDERSHIP}.json"
ROUTE = "7"
EVENT_STOP = "702"  # Mets-Willets Point
SUMMARY = Path(__file__).with_name("mta_7line.json")
# station complexes that the 7 serves (complex id -> number of services sharing it, for apportioning entries)
COMPLEXES = {"447": 1, "448": 1, "449": 1, "450": 1, "451": 1, "452": 1, "453": 1, "455": 1, "456": 1,
             "457": 1, "458": 1, "459": 1, "460": 1, "461": 3, "463": 1, "464": 1, "471": 1, "606": 4,
             "609": 5, "610": 5, "611": 12, "616": 5}
# GTFS parent stop -> ridership complex
STOP_COMPLEX = {"701": "447", "702": "448", "705": "449", "706": "450", "707": "451", "708": "452", "709": "453",
                "710": "616", "711": "455", "712": "456", "713": "457", "714": "458", "715": "459", "716": "460",
                "718": "461", "719": "606", "720": "463", "721": "464", "723": "610", "724": "609", "725": "611",
                "726": "471"}


def fetch_gtfs(timeout: float = 180.0) -> tuple[bytes, str]:
    with urllib.request.urlopen(GTFS_URL, timeout=timeout) as r:  # noqa: S310 - fixed https URL
        blob = r.read()
    return blob, hashlib.sha256(blob).hexdigest()


def _rows(z: zipfile.ZipFile, name: str):
    return csv.DictReader(io.TextIOWrapper(z.open(name), encoding="utf-8-sig"))


def _secs(hms: str) -> int:
    h, m, s = (int(x) for x in hms.split(":"))
    return 3600 * h + 60 * m + s


def _haversine(a, b) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371000.0 * math.asin(math.sqrt(h))


def line_from_gtfs(blob: bytes, route: str = ROUTE) -> dict:
    """Stations in order (toward Manhattan), positions along the shape, stop-to-stop times, headways."""
    z = zipfile.ZipFile(io.BytesIO(blob))
    feed = next(_rows(z, "feed_info.txt"))
    trips = {t["trip_id"]: t for t in _rows(z, "trips.txt") if t["route_id"] in (route, route + "X")}
    stops = {s["stop_id"]: s for s in _rows(z, "stops.txt")}
    st = defaultdict(list)
    for r in _rows(z, "stop_times.txt"):
        if r["trip_id"] in trips:
            st[r["trip_id"]].append((int(r["stop_sequence"]), r["stop_id"][:3], _secs(r["departure_time"])))
    for v in st.values():
        v.sort()
    local = [k for k in st if trips[k]["route_id"] == route]
    full = max(len(st[k]) for k in local)
    ref = Counter(tuple(s for _, s, _ in st[k]) for k in local if len(st[k]) == full).most_common(1)[0][0]
    if trips[next(k for k in local if tuple(s for _, s, _ in st[k]) == ref)]["direction_id"] == "0":
        ref = ref[::-1]
    # positions along the shape of a full-length trip
    k0 = next(k for k in local if len(st[k]) == full)
    shape_id = trips[k0]["shape_id"]
    pts = [(float(r["shape_pt_lat"]), float(r["shape_pt_lon"])) for r in _rows(z, "shapes.txt")
           if r["shape_id"] == shape_id]
    cum = [0.0]
    for a, b in zip(pts, pts[1:], strict=False):
        cum.append(cum[-1] + _haversine(a, b))
    pos = []
    for sid in ref:
        ll = (float(stops[sid]["stop_lat"]), float(stops[sid]["stop_lon"]))
        pos.append(cum[min(range(len(pts)), key=lambda i: _haversine(pts[i], ll))])
    if pos[-1] < pos[0]:
        pos = [cum[-1] - p for p in pos]
    pos = [p - pos[0] for p in pos]
    # scheduled stop-to-stop times (weekday local trips that stop at both ends of a segment), both directions
    seg = defaultdict(list)
    for k in local:
        if trips[k]["service_id"] != "Weekday":
            continue
        seq = st[k]
        for (_, a, ta), (_, b, tb) in zip(seq, seq[1:], strict=False):
            if a in ref and b in ref and abs(ref.index(a) - ref.index(b)) == 1:
                seg[min(ref.index(a), ref.index(b))].append(tb - ta)
    seg_s = [float(statistics.median(seg[i])) for i in range(len(ref) - 1)]
    # headways at the event station by service day, direction and hour (local + express)
    deps = defaultdict(list)
    for k, seq in st.items():
        for _, s, t in seq:
            if s == EVENT_STOP:
                deps[(trips[k]["service_id"], trips[k]["direction_id"])].append(t)
    headway = {}
    for (svc, d), ts in deps.items():
        ts.sort()
        by_hour = defaultdict(list)
        for a, b in zip(ts, ts[1:], strict=False):
            by_hour[(a // 3600) % 24].append(b - a)
        headway[f"{svc}:{d}"] = {str(h): float(statistics.median(v)) for h, v in sorted(by_hour.items())}
    express = Counter(tuple(s for _, s, _ in st[k]) for k in st if trips[k]["route_id"] == route + "X")
    return {
        "route": route,
        "feed_version": feed.get("feed_version"),
        "stations": [{"stop_id": s, "name": stops[s]["stop_name"], "pos_m": round(p, 1),
                      "complex_id": STOP_COMPLEX.get(s)} for s, p in zip(ref, pos, strict=True)],
        "segment_s": seg_s,
        "segment_n": [len(seg[i]) for i in range(len(ref) - 1)],
        "headway_s": headway,
        "express_patterns": [list(p) for p, _ in express.most_common(2)],
        "direction_note": "station order runs toward Manhattan (GTFS direction_id 1); headway keys are service:direction_id",
    }


def ridership_query(complex_id: str, year: int = 2024) -> dict:
    return {
        "$select": "station_complex_id,date_extract_hh(transit_timestamp) as hh,"
                   "date_extract_dow(transit_timestamp) as dow,sum(ridership) as r",
        "$where": f"transit_timestamp between '{year}-01-01T00:00:00' and '{year}-12-31T23:59:59' "
                  f"AND station_complex_id='{complex_id}'",
        "$group": "station_complex_id,hh,dow",
        "$limit": "500",
    }


def fetch_ridership(year: int = 2024, timeout: float = 600.0) -> tuple[list[dict], dict]:
    """One query per complex (a single grouped query over all complexes times out)."""
    rows = []
    for c in COMPLEXES:
        q = ridership_query(c, year)
        with urllib.request.urlopen(f"{RIDERSHIP_API}?{urllib.parse.urlencode(q)}", timeout=timeout) as r:  # noqa: S310
            rows += json.loads(r.read().decode())
    return rows, ridership_query("<complex_id>", year)


def peak_hours_query(complex_id: str = "448", year: int = 2024, n: int = 20) -> dict:
    return {"$select": "transit_timestamp,sum(ridership) as r",
            "$where": f"station_complex_id='{complex_id}' AND transit_timestamp between '{year}-01-01T00:00:00' "
                      f"and '{year}-12-31T23:59:59'",
            "$group": "transit_timestamp", "$order": "r DESC", "$limit": str(n)}


def summarize_ridership(rows: list[dict], year: int = 2024) -> dict:
    """Mean hourly entries per complex, apportioned to the 7 by the number of services in the complex."""
    days = Counter(datetime(year, 1, 1).toordinal() + i for i in range(366 if year % 4 == 0 else 365))
    n_dow = Counter((datetime.fromordinal(d).isoweekday() % 7) for d in days)  # SoQL dow: 0 = Sunday
    out = defaultdict(lambda: {"weekday": [0.0] * 24, "weekend": [0.0] * 24})
    for r in rows:
        c, h, dow = r["station_complex_id"], int(r["hh"]), int(r["dow"])
        kind = "weekend" if dow in (0, 6) else "weekday"
        n = sum(n_dow[d] for d in ((0, 6) if kind == "weekend" else (1, 2, 3, 4, 5)))
        out[c][kind][h] += float(r["r"]) / n / COMPLEXES[c]
    return {c: {k: [round(x, 1) for x in v] for k, v in d.items()} for c, d in out.items()}


def build(out: Path = SUMMARY, year: int = 2024) -> dict:
    blob, sha = fetch_gtfs()
    line = line_from_gtfs(blob)
    rows, q = fetch_ridership(year)
    peak_q = peak_hours_query(year=year)
    with urllib.request.urlopen(f"{RIDERSHIP_API}?{urllib.parse.urlencode(peak_q)}", timeout=600) as r:  # noqa: S310
        peaks = json.loads(r.read().decode())
    summary = {
        **line,
        "sources": {
            "gtfs_url": GTFS_URL, "gtfs_sha256": sha,
            "ridership_dataset": f"data.ny.gov/{RIDERSHIP}", "ridership_query": q, "ridership_year": year,
            "peak_query": peak_q,
            "fetched_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "ridership_hourly_entries": summarize_ridership(rows, year),
        "event_station_peak_hours": [{"t": p["transit_timestamp"], "entries": float(p["r"])} for p in peaks],
    }
    out.write_text(json.dumps(summary, indent=1) + "\n")
    return summary


def load_line_stock(path: Path = SUMMARY) -> dict:
    return json.loads(Path(path).read_text())


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(SUMMARY))
    ap.add_argument("--year", type=int, default=2024)
    a = ap.parse_args()
    s = build(Path(a.out), a.year)
    print(json.dumps({k: s[k] for k in ("feed_version", "segment_s")}, indent=1))
