"""EIA API v2 weekly regular gasoline (product EPMR) for every area (task 058).
Stdlib only. Errors name the HTTP status, never the URL (it holds the key)."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://api.eia.gov"


def _get(path: str, params: list[tuple[str, str]]) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}?{urllib.parse.urlencode(params)}", headers={"User-Agent": "Mozilla/5.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"EIA HTTP {exc.code} on {path}") from None


def record_from_rows(duoarea: str, rows: list[dict]) -> dict:
    pairs = [(r["period"], r["value"]) for r in rows if r.get("value") is not None]
    return {
        "duoarea": duoarea,
        "area_name": rows[0]["area-name"] if rows else None,
        "series": rows[0]["series"] if rows else None,
        "periods": [p for p, _ in pairs],
        "values": [float(v) for _, v in pairs],
    }


def fetch_all(key: str) -> dict[str, dict]:
    facet = _get("/v2/petroleum/pri/gnd/facet/duoarea/", [("api_key", key)])
    out: dict[str, dict] = {}
    for duoarea in sorted(f["id"] for f in facet["response"]["facets"]):
        body = _get(
            "/v2/petroleum/pri/gnd/data/",
            [
                ("api_key", key), ("frequency", "weekly"), ("data[0]", "value"),
                ("facets[product][]", "EPMR"), ("facets[duoarea][]", duoarea),
                ("sort[0][column]", "period"), ("sort[0][direction]", "asc"),
                ("offset", "0"), ("length", "5000"),
            ],
        )
        record = record_from_rows(duoarea, body["response"]["data"])
        if record["periods"]:
            out[duoarea] = record
        time.sleep(0.25)
    return out


def newest_period(records: dict[str, dict]) -> str | None:
    lasts = [r["periods"][-1] for r in records.values() if r.get("periods")]
    return max(lasts) if lasts else None
