import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "cloud" / "quote_reader"))

from normalize import normalize, parse_money, vin_check_ok  # noqa: E402

GOOD_VIN = "1HGCV2FA9SB601815"


def raw(**kw):
    base = {"doc_type": "buyers_order", "transcript": [], "pairs": [], "fees": []}
    base.update(kw)
    return base


def test_vin_check_digit():
    assert vin_check_ok(GOOD_VIN)
    assert not vin_check_ok("1HGCV2FA0SB601815")  # wrong check digit
    assert not vin_check_ok("1HGCV2FA9SB60181")  # 16 characters
    assert not vin_check_ok("1HGCV2FA9SB60181O")  # letter O is never in a VIN


def test_vin_prefers_valid_candidate_and_flags_bad():
    n = normalize(raw(transcript=[f"VIN {GOOD_VIN}"]))
    assert n["vin"] == GOOD_VIN and n["vin_check_ok"]
    bad = normalize(raw(transcript=["VIN 1HGCV2FA0SB601815"]))
    assert bad["vin"] == "1HGCV2FA0SB601815" and not bad["vin_check_ok"]
    assert normalize(raw(transcript=["no vin here"]))["vin"] is None


def test_year_and_vehicle_line_ignore_dates_and_vin_lines():
    n = normalize(raw(transcript=["Printed 2025-11-03", f"VIN {GOOD_VIN}", "2026 Brightwater Zenith Sport"]))
    assert n["year"] == 2026 and n["vehicle_text"] == "Brightwater Zenith Sport"


def test_money_fields_come_only_from_printed_pairs():
    pairs = [
        {"label": "Selling price", "value": "$28,450.00"},
        {"label": "Down payment", "value": "$2,000.00"},
        {"label": "Out the door", "value": "$30,628.00"},
    ]
    n = normalize(raw(pairs=pairs))
    assert (n["selling_price"], n["down"], n["out_the_door"]) == (28450.0, 2000.0, 30628.0)
    assert n["msrp"] is None and n["rebates"] is None  # absent stays null, never guessed


def test_apr_term_and_mpg_from_text():
    n = normalize(raw(transcript=["APR 7.25%  Term 60 months", "EPA combined 31 MPG"]))
    assert (n["apr"], n["term_months"], n["epa_combined_mpg"]) == (7.25, 60, 31)
    n2 = normalize(raw(transcript=["APR 6.9%", "72 months"]))
    assert (n2["apr"], n2["term_months"]) == (6.9, 72)


def test_fees_drop_non_fee_lines_but_keep_kinds():
    fees = [
        {"label": "Documentary fee", "amount": 799, "kind": "dealer"},
        {"label": "Nitrogen tire fill", "amount": 199, "kind": "addon"},
        {"label": "Down payment", "amount": 2000, "kind": "unknown"},
        {"label": "Out the door", "amount": 30628, "kind": "unknown"},
    ]
    n = normalize(raw(fees=fees))
    assert [f["label"] for f in n["fees"]] == ["Documentary fee", "Nitrogen tire fill"]
    assert n["fees"][1]["kind"] == "addon"


def test_parse_money():
    assert parse_money("$1,234.50") == 1234.5
    assert parse_money("$639.18 / mo") == 639.18
    assert parse_money("n/a") is None


def test_known_addons_override_a_dealer_tag():
    fees = [
        {"label": "Nitrogen tire fill", "amount": 199, "kind": "dealer"},
        {"label": "Paint and fabric protection", "amount": 995, "kind": "dealer"},
        {"label": "Documentary fee", "amount": 799, "kind": "dealer"},
        {"label": "Title and registration", "amount": 185, "kind": "government"},
    ]
    kinds = [f["kind"] for f in normalize(raw(fees=fees))["fees"]]
    assert kinds == ["addon", "addon", "dealer", "government"]


def test_down_payment_is_never_the_monthly_payment():
    pairs = [
        {"label": "Down payment", "value": "$5,000.00"},
        {"label": "Selling price", "value": "$36,850.00"},
    ]
    n = normalize(raw(pairs=pairs))
    assert n["down"] == 5000.0 and n["stated_monthly"] is None
    n2 = normalize(raw(pairs=[*pairs, {"label": "YOUR PAYMENT", "value": "$639.18 / mo"}]))
    assert n2["stated_monthly"] == 639.18
