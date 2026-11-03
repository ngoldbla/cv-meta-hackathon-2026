"""Vehicle sales-tax rules for the weekly table (task 037, P19).

The researched per-state rule table itself lives outside git in
~/.cache/low-key/tax-rules.json (one entry per state plus DC, each
with its state revenue/DMV source URL and access date, plus the Tax
Foundation state-and-average-local table it was checked against).
Only the loader, validation and arithmetic live here, mirroring
lifespan.py: a missing or malformed cache means no tax section in
the table, never guessed rates. build_table.py merges the validated
section into the private Blob table as `tax`, with its sources and
dates; the app (lowkey/app/lib/tax.ts) does the same arithmetic.

Tax model (task 037, part 3): tax is charged on the price with fees
(the provider's price_with_fees, which part 1 showed is before tax
and registration). Most states tax that price at state + average
local; excise-style states use a flat vehicle rate; Georgia (TAVT),
North Carolina (highway use tax) and South Carolina (infrastructure
maintenance fee, capped) have their own kinds; DC is tiered by MPG.
Trade-in credits, value-based minimums and per-county rates are out
of scope and noted per state in the cache.
"""

from __future__ import annotations

import json
from pathlib import Path

DEFAULT_CACHE = Path.home() / ".cache" / "low-key" / "tax-rules.json"
KINDS = {"sales", "tavt", "hut", "excise", "imf", "dc", "none"}
EXPECTED_STATES = 51  # 50 states + DC


def _num(value: object) -> float | None:
    if isinstance(value, (int, float)) and value == value and value >= 0:
        return float(value)
    return None


def _clean_rule(raw: object) -> dict | None:
    if not isinstance(raw, dict):
        return None
    state = raw.get("state")
    kind = raw.get("kind")
    if not isinstance(state, str) or len(state) != 2:
        return None
    if kind not in KINDS:
        return None
    state_rate = _num(raw.get("stateRate"))
    avg_local = _num(raw.get("avgLocalRate"))
    if state_rate is None or avg_local is None:
        return None
    if state_rate > 0.30 or avg_local > 0.30:
        return None
    cap = _num(raw.get("cap")) if raw.get("cap") is not None else None
    local_cap = (
        _num(raw.get("localBaseCap")) if raw.get("localBaseCap") is not None else None
    )
    flat_add = _num(raw.get("flatAdd")) or 0.0
    vehicle_add = _num(raw.get("vehicleAddRate")) or 0.0
    bands = None
    if kind == "dc":
        raw_bands = raw.get("mpgBands")
        if not isinstance(raw_bands, list) or not raw_bands:
            return None
        bands = []
        for band in raw_bands:
            if not isinstance(band, dict):
                return None
            rate = _num(band.get("rate"))
            if rate is None:
                return None
            max_mpg = band.get("maxMpg")
            bands.append(
                {
                    "maxMpg": float(max_mpg) if isinstance(max_mpg, (int, float)) else None,
                    "rate": rate,
                }
            )
    if not isinstance(raw.get("sourceUrl"), str) or not raw["sourceUrl"].startswith("http"):
        return None
    if not isinstance(raw.get("sourceDate"), str) or not raw["sourceDate"]:
        return None
    return {
        "state": state,
        "name": raw.get("name") if isinstance(raw.get("name"), str) else state,
        "kind": kind,
        "label": raw.get("label") if isinstance(raw.get("label"), str) else state,
        "stateRate": state_rate,
        "avgLocalRate": avg_local,
        "cap": cap,
        "localBaseCap": local_cap,
        "flatAdd": flat_add,
        "vehicleAddRate": vehicle_add,
        "mpgBands": bands,
        "base": raw.get("base") if isinstance(raw.get("base"), str) else "price_with_fees",
        "note": raw.get("note") if isinstance(raw.get("note"), str) else "",
        "sourceUrl": raw["sourceUrl"],
        "sourceDate": raw["sourceDate"],
    }


def load_tax_rules(path: Path = DEFAULT_CACHE) -> dict:
    """Validated tax section for the Blob table (empty when absent).

    Shape: {"version": int, "asOf": str, "taxFoundation": {...},
    "states": {code: rule}}. A missing, malformed or incomplete
    file yields {"states": {}} so the build can omit tax rather
    than guess; weekly.sh treats that as a failure.
    """
    empty: dict = {"version": None, "asOf": None, "taxFoundation": None, "states": {}}
    try:
        data = json.loads(path.read_text())
    except Exception:
        return empty
    if not isinstance(data, dict) or not isinstance(data.get("states"), dict):
        return empty
    states: dict[str, dict] = {}
    for code, raw in data["states"].items():
        rule = _clean_rule(raw)
        if rule is None or rule["state"] != code:
            return empty
        states[code] = rule
    if len(states) != EXPECTED_STATES:
        return empty
    foundation = data.get("taxFoundation")
    if not isinstance(foundation, dict) or not foundation.get("url"):
        return empty
    return {
        "version": data.get("version"),
        "asOf": data.get("asOf"),
        "taxFoundation": foundation,
        "states": states,
    }


def tax_amount(rule: dict, price_with_fees: float, mpg: float | None = None) -> float:
    """Tax in dollars for one rule and price (mirror of lib/tax.ts)."""
    if price_with_fees <= 0 or rule["kind"] == "none":
        return 0.0
    if rule["kind"] == "dc":
        rate = None
        for band in rule.get("mpgBands") or []:
            if band["maxMpg"] is None or (mpg or 0) <= band["maxMpg"]:
                rate = band["rate"]
                break
        if rate is None:
            return 0.0
        return price_with_fees * rate
    local_base = min(price_with_fees, rule["localBaseCap"] or price_with_fees)
    amount = (
        price_with_fees * rule["stateRate"]
        + local_base * rule["avgLocalRate"]
        + price_with_fees * rule["vehicleAddRate"]
        + rule["flatAdd"]
    )
    if rule["cap"] is not None:
        amount = min(amount, rule["cap"])
    return amount
