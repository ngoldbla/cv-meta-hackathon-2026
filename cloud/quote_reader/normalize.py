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
# A VIN printed in groups: 17 VIN characters with single spaces or hyphens between groups.
_VIN_SPACED = re.compile(r"(?<![A-Z0-9])[A-HJ-NPR-Z0-9]{2,}(?:[ -][A-HJ-NPR-Z0-9]{2,})+(?![A-Z0-9])")

# canonical field -> label fragments, most specific first; matched on the whole label
_LABELS = {
    "msrp": ["total msrp", "msrp", "manufacturers suggested retail price"],
    "selling_price": ["selling price", "cash price", "vehicle price", "sale price", "sales price"],
    "down": ["down payment", "cash down", "cash down payment", "down"],
    "out_the_door": ["out the door", "out-the-door", "otd", "total due", "total cash price"],
    "amount_financed": ["amount financed", "amount to finance", "total amount financed", "balance financed"],
    "stated_monthly": ["your payment", "monthly payment", "payment", "per month"],
    "rebates": ["rebate", "rebates", "incentive", "customer cash"],
    "trade_in": ["trade-in", "trade in", "trade allowance"],
}
# Optional dealer products: a label matching these is always an add-on,
# whatever the model tagged it (task 046: add-ons are shown on their own line).
_ADDONS = re.compile(
    r"nitrogen|etch|protect|coating|sealant|tint|wheel lock|pinstrip|theft|lojack|"
    r"appearance|market adjust|additional dealer markup|adm\b|dealer add|accessor|"
    r"gap\b|service contract|extended warranty|maintenance plan|key replacement",
    re.I,
)
# Labels a field must never take its value from.
_EXCLUDE = {
    # "Down payment" is not a payment.
    "stated_monthly": re.compile(r"down|due at signing|total", re.I),
    "selling_price": re.compile(r"msrp|base|average|market", re.I),
    # "Total Savings + Rebate" is the gap to a market average, already inside the
    # selling price; subtracting it again would understate the total.
    "rebates": re.compile(r"saving|market|average|discount", re.I),
    "msrp": re.compile(r"not included|base", re.I),
}
# fee lines that are really other fields (tax lines are kept: "Total Taxes" is a fee)
_NOT_FEES = re.compile(
    r"price|down|out.?the.?door|total(?!\s*tax)|apr|term|payment|msrp|trade|rebate|saving|financed", re.I
)
# Fees the dealer charges on every sale: never an optional add-on, whatever the model tagged.
_DEALER_FEE = re.compile(
    r"\bdoc(?:umentary|ument)?\b|dealer (?:service|handling|processing)|processing fee|conveyance", re.I
)
_TAXLIKE = re.compile(r"\btax(es)?\b|title|registration|license|tag\b", re.I)
_FEELIKE = re.compile(r"\bfee\b|\bfees\b|\bcharge\b", re.I)
_TAX_NOT_FEE = re.compile(r"not included|exempt|federal taxes", re.I)
# World manufacturer identifiers (VIN positions 1-3) for common U.S. makes.
_WMI = {
    "JTH": "Lexus",
    "JTJ": "Lexus",
    "2T2": "Lexus",
    "58A": "Lexus",
    "JTD": "Toyota",
    "JTE": "Toyota",
    "JTM": "Toyota",
    "JTN": "Toyota",
    "2T1": "Toyota",
    "2T3": "Toyota",
    "4T1": "Toyota",
    "4T3": "Toyota",
    "5TD": "Toyota",
    "5TF": "Toyota",
    "5YF": "Toyota",
    "7MU": "Toyota",
    "1HG": "Honda",
    "2HG": "Honda",
    "5FN": "Honda",
    "5J6": "Honda",
    "7FA": "Honda",
    "19X": "Honda",
    "JHM": "Honda",
    "SHH": "Honda",
    "19U": "Acura",
    "5J8": "Acura",
    "1FA": "Ford",
    "1FM": "Ford",
    "1FT": "Ford",
    "3FA": "Ford",
    "1GC": "Chevrolet",
    "1G1": "Chevrolet",
    "3GN": "Chevrolet",
    "1GT": "GMC",
    "3GT": "GMC",
    "KM8": "Hyundai",
    "5NM": "Hyundai",
    "5NP": "Hyundai",
    "KNA": "Kia",
    "KND": "Kia",
    "5XY": "Kia",
    "JM1": "Mazda",
    "JM3": "Mazda",
    "4S4": "Subaru",
    "JF2": "Subaru",
    "4S3": "Subaru",
    "1N4": "Nissan",
    "5N1": "Nissan",
    "3N1": "Nissan",
    "JN8": "Nissan",
    "1C4": "Jeep",
    "1C6": "Ram",
    "3C6": "Ram",
    "WBA": "BMW",
    "5UX": "BMW",
    "WDD": "Mercedes-Benz",
    "W1K": "Mercedes-Benz",
    "WA1": "Audi",
    "WAU": "Audi",
    "3VW": "Volkswagen",
    "1V2": "Volkswagen",
    "5YJ": "Tesla",
    "7SA": "Tesla",
}
_MONEY_LINE = re.compile(r"^\s*\$\s*[\d,]+(?:\.\d{2})?\s*$")
_RANGE_CELL = re.compile(r"^\s*\$\s*([\d,]+(?:\.\d{2})?)\s*(?:[-–]\s*\$?\s*([\d,]+(?:\.\d{2})?))?\s*$")


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


_MONTHS_TOKEN = re.compile(r"\b(\d{2,3})\s*(?:months|mos?)\b\.?", re.I)
_MONEY = r"\$\s*[\d,]+(?:\.\d{2})?"
_RANGE = rf"{_MONEY}\s*[-–]\s*\$?\s*[\d,]+(?:\.\d{{2}})?"
_GRID_ROW = re.compile(rf"^\s*({_MONEY})((?:\s+{_RANGE})+)\s*$")


def _grid_cells(lines: list[str]) -> list[str]:
    """Split a grid copied row by row into one cell per line.

    "Purchase 60 Months 72 Months" becomes "60 Months", "72 Months";
    "$2,000 $500 - $525 $434 - $459" becomes "$2,000", "$500 - $525", "$434 - $459".
    """
    out: list[str] = []
    for line in lines:
        months = _MONTHS_TOKEN.findall(line)
        row = _GRID_ROW.match(line)
        if len(months) >= 2:
            out.extend(f"{m} Months" for m in months)
        elif row:
            out.append(row.group(1))
            out.extend(re.findall(_RANGE, row.group(2)))
        else:
            out.append(line)
    return out


def _payment_grid(lines: list[str]) -> tuple[list[int], list[dict]]:
    """A dealer's payment grid ("$ Down" rows x "60 Months" columns of ranges).

    Returns the term columns and one option per cell: {down, term_months,
    low, high}. Reads the transcript in order, as the model copied it, one
    cell per line or one grid row per line.
    """
    lines = _grid_cells(lines)
    terms: list[int] = []
    for line in lines:
        m = re.match(r"^\s*(\d{2,3})\s*(?:months|mos?)\.?\s*$", line, re.I)
        if m:
            terms.append(int(m.group(1)))
    if len(terms) < 1:
        return terms, []
    options: list[dict] = []
    i = 0
    while i < len(lines):
        if _MONEY_LINE.match(lines[i]) and i + len(terms) < len(lines):
            cells = [_RANGE_CELL.match(lines[i + 1 + j]) for j in range(len(terms))]
            if all(c and c.group(2) for c in cells):
                down = parse_money(lines[i])
                for term, c in zip(terms, cells, strict=True):
                    options.append(
                        {
                            "down": down,
                            "term_months": term,
                            "low": float(c.group(1).replace(",", "")),
                            "high": float(c.group(2).replace(",", "")),
                        }
                    )
                i += 1 + len(terms)
                continue
        i += 1
    return terms, options


def normalize(raw: dict) -> dict:
    lines = [str(x) for x in raw.get("transcript", [])]
    text = "\n".join(lines)
    doc_type = raw.get("doc_type", "other")
    out: dict = {"doc_type": doc_type, "transcript": lines}

    # VIN: regex over the transcript; prefer a candidate whose check digit holds.
    cands = _VIN.findall(text.upper())
    good = [c for c in cands if vin_check_ok(c)]
    if not good:
        # Stickers and photos often split a VIN ("JTD LM5RC1TB212233"). A joined
        # run counts only if its check digit holds, so words can't merge into one.
        for run in _VIN_SPACED.findall(text.upper()):
            groups = re.split(r"[ -]", run)
            for i in range(len(groups)):
                for j in range(i + 2, len(groups) + 1):
                    joined = "".join(groups[i:j])
                    if len(joined) == 17 and vin_check_ok(joined) and joined not in good:
                        good.append(joined)
    vin = (good or cands or [None])[0]
    out["vin"] = vin
    out["vin_check_ok"] = bool(good)

    # Year and the vehicle line: first line that starts with a model year
    # ("2025 Toyota Corolla", or a sticker's "2012 / 9900G CT 200h PREMIUM").
    out["year"], out["vehicle_text"] = None, None
    for line in lines:
        m = re.match(
            r"^\s*(?:description\s*:?\s*)?((?:19|20)\d\d)\s*(?:/\s*[A-Z0-9]{3,6}\s+)?([A-Za-z].*)$",
            line,
            re.I,
        )
        if m:
            vehicle = re.sub(r",?\s*body type\s*:.*$", "", m.group(2), flags=re.I).strip(" ,")
            out["year"], out["vehicle_text"] = int(m.group(1)), vehicle
            break

    # Money fields from printed label/value pairs.
    pairs = [(_label_key(p.get("label", "")), str(p.get("value", ""))) for p in raw.get("pairs", [])]

    def pick(frags, ex):
        for frag in frags:
            hit = next(
                (
                    v
                    for k, v in pairs
                    if (k == frag or (len(frag) > 4 and frag in k)) and not (ex and ex.search(k))
                ),
                None,
            )
            if hit is not None and parse_money(hit) is not None:
                return parse_money(hit)
        return None

    for field, frags in _LABELS.items():
        out[field] = pick(frags, _EXCLUDE.get(field))
    if doc_type == "window_sticker":
        # On a sticker the TOTAL line is the full MSRP (options and destination included).
        total = next((parse_money(v) for k, v in pairs if k in ("total", "total price", "total msrp")), None)
        if total is not None:
            out["msrp"] = total

    # APR, term and EPA MPG: printed inline, so read them from the text.
    m = re.search(r"\bAPR\b[^\d]{0,12}(\d{1,2}(?:\.\d+)?)\s*%", text, re.I)
    out["apr"] = float(m.group(1)) if m else None
    m = re.search(r"\bterm\b[^\d]{0,12}(\d{2,3})\b", text, re.I)
    if m:
        out["term_months"] = int(m.group(1))
    else:
        # Only when the page names exactly one loan length; a grid of 60 and 72
        # months is a set of options, not a term.
        found = {int(x) for x in re.findall(r"\b(\d{2,3})\s*(?:months|mos?\b)", text, re.I)}
        out["term_months"] = found.pop() if len(found) == 1 else None
    # EPA combined MPG: the labelled pair first ("Fuel Economy: 42 MPG"); the
    # sticker's small print ("range from 10 to 60 MPG") must never win.
    out["epa_combined_mpg"] = None
    for k, v in pairs:
        if re.search(r"fuel economy|combined|mpg", k) and not re.search(r"range|best|rating", k):
            mm = re.search(r"\b(\d{2})\s*(?:MPG)?\b", v, re.I)
            if mm and 8 <= int(mm.group(1)) <= 80:
                out["epa_combined_mpg"] = int(mm.group(1))
                break
    if out["epa_combined_mpg"] is None:
        clean = "\n".join(
            x for x in lines if not re.search(r"range from|best vehicle|average new vehicle", x, re.I)
        )
        mm = re.search(r"combined[^\d]{0,20}(\d{2})\s*MPG", clean, re.I) or re.search(
            r"\b(\d{2})\s*MPG\b", clean, re.I
        )
        out["epa_combined_mpg"] = int(mm.group(1)) if mm else None

    # Make from the VIN's manufacturer code when the page prints no make
    # (a sticker carries it only in the logo). Labelled as from the VIN.
    out["make_from_vin"] = _WMI.get(vin[:3]) if vin and out["vin_check_ok"] else None

    # The payment grid, when the sheet has one.
    _, out["payment_options"] = _payment_grid(lines)

    if doc_type == "window_sticker":
        # Options and destination are already inside the sticker's total.
        out["fees"] = []
    else:
        fees = [
            {
                "label": f["label"],
                "amount": f.get("amount"),
                "kind": "addon"
                if _ADDONS.search(f.get("label", ""))
                else (
                    "government"
                    if _TAXLIKE.search(f.get("label", ""))
                    else ("dealer" if _DEALER_FEE.search(f.get("label", "")) else f.get("kind", "unknown"))
                ),
            }
            for f in raw.get("fees", [])
            if not _NOT_FEES.search(f.get("label", "")) and not _TAX_NOT_FEE.search(f.get("label", ""))
        ]
        # Backfill fee and tax lines the model paired but didn't list as fees.
        have = {_label_key(f["label"]) for f in fees}
        for p in raw.get("pairs", []):
            label = p.get("label", "")
            key = _label_key(label)
            amount = parse_money(str(p.get("value", "")))
            if key in have or amount is None or _TAX_NOT_FEE.search(label):
                continue
            # Add-ons rarely say "fee" ("Nitrogen tire fill"), so match them by name too.
            feelike = _FEELIKE.search(label) or _ADDONS.search(label)
            if _TAXLIKE.search(label) or (feelike and not _NOT_FEES.search(label)):
                kind = (
                    "addon"
                    if _ADDONS.search(label)
                    else ("government" if _TAXLIKE.search(label) else "dealer")
                )
                fees.append({"label": label, "amount": amount, "kind": kind})
                have.add(key)
        out["fees"] = fees
    out["pairs"] = [
        {"label": p.get("label", ""), "value": str(p.get("value", ""))} for p in raw.get("pairs", [])
    ]
    return out
