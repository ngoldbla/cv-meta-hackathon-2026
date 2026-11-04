"""Turn the model's raw reading into a Quote-shaped dict, in plain code (task 047).

The model only transcribes the page, pairs each printed label with its
printed value, and tags fee lines. Everything else is decided here, so
every number on the result traces to a pair the page printed, and the
VIN is validated by its check digit instead of trusted.
"""

import re

_TRANS = dict(
    zip(
        "ABCDEFGHJKLMNPRSTUVWXYZ",
        [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 7, 9, 2, 3, 4, 5, 6, 7, 8, 9],
        strict=True,
    )
)
_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
_VIN = re.compile(r"(?<![A-Z0-9])[A-HJ-NPR-Z0-9]{17}(?![A-Z0-9])")

# canonical field -> label fragments, most specific first; matched on the whole label
_LABELS = {
    "msrp": ["total msrp", "msrp"],
    "selling_price": ["selling price", "cash price", "vehicle price", "sale price", "sales price"],
    "down": ["down payment", "cash down", "cash down payment", "down"],
    "out_the_door": ["out the door", "out-the-door", "otd", "total due", "total cash price"],
    "stated_monthly": ["your payment", "monthly payment", "payment", "per month"],
    "rebates": ["rebate", "rebates", "incentive"],
    "trade_in": ["trade-in", "trade in", "trade allowance"],
}
# fee lines that are really other fields
_NOT_FEES = re.compile(r"price|down|out.?the.?door|total|apr|term|payment|msrp|trade|rebate", re.I)


def vin_check_ok(vin: str) -> bool:
    if len(vin) != 17 or any(c in "IOQ" for c in vin):
        return False
    try:
        total = sum((int(c) if c.isdigit() else _TRANS[c]) * w for c, w in zip(vin, _WEIGHTS, strict=True))
    except KeyError:
        return False
    check = "X" if total % 11 == 10 else str(total % 11)
    return vin[8] == check


def parse_money(text: str) -> float | None:
    m = re.search(r"\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?", text.replace(" ", ""))
    if not m:
        return None
    return float(m.group(1).replace(",", "") + ("." + m.group(2) if m.group(2) else ""))


def _label_key(label: str) -> str:
    return re.sub(r"[^a-z0-9 -]", "", label.lower()).strip()


def normalize(raw: dict) -> dict:
    lines = [str(x) for x in raw.get("transcript", [])]
    text = "\n".join(lines)
    out: dict = {"doc_type": raw.get("doc_type", "other"), "transcript": lines}

    # VIN: regex over the transcript; prefer a candidate whose check digit holds.
    cands = _VIN.findall(text.upper())
    good = [c for c in cands if vin_check_ok(c)]
    vin = (good or cands or [None])[0]
    out["vin"] = vin
    out["vin_check_ok"] = bool(good)

    # Year and the vehicle line: first line that starts with a model year.
    out["year"], out["vehicle_text"] = None, None
    for line in lines:
        m = re.match(r"^\s*((?:19|20)\d\d)\s+([A-Za-z].*)$", line)
        if m:
            out["year"], out["vehicle_text"] = int(m.group(1)), m.group(2).strip()
            break

    # Money fields from printed label/value pairs.
    pairs = [(_label_key(p.get("label", "")), str(p.get("value", ""))) for p in raw.get("pairs", [])]
    for field, frags in _LABELS.items():
        out[field] = None
        for frag in frags:
            hit = next((v for k, v in pairs if k == frag or (len(frag) > 4 and frag in k)), None)
            if hit is not None:
                out[field] = parse_money(hit)
                if out[field] is not None:
                    break

    # APR, term and EPA MPG: printed inline, so read them from the text.
    m = re.search(r"\bAPR\b[^\d]{0,12}(\d{1,2}(?:\.\d+)?)\s*%", text, re.I)
    out["apr"] = float(m.group(1)) if m else None
    m = re.search(r"\bterm\b[^\d]{0,12}(\d{2,3})\b", text, re.I) or re.search(
        r"\b(\d{2,3})\s*(?:months|mos?\b)", text, re.I
    )
    out["term_months"] = int(m.group(1)) if m else None
    m = re.search(r"\b(\d{2})\s*MPG\b", text, re.I)
    out["epa_combined_mpg"] = int(m.group(1)) if m else None

    out["fees"] = [
        {"label": f["label"], "amount": f.get("amount"), "kind": f.get("kind", "unknown")}
        for f in raw.get("fees", [])
        if not _NOT_FEES.search(f.get("label", ""))
    ]
    out["pairs"] = [
        {"label": p.get("label", ""), "value": str(p.get("value", ""))} for p in raw.get("pairs", [])
    ]
    return out
