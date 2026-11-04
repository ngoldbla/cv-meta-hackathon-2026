import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

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


# Layouts seen on real paperwork (2026-11-04); values invented.
WORKSHEET = [
    "2025 Brightwater Zenith, Body Type: 4dr Car",
    "VIN:1HGCV2FA9SB601815",
    "Purchase",
    "60 Months",
    "72 Months",
    "$ Down",
    "$2,000",
    "$500 - $525",
    "$434 - $459",
    "$4,000",
    "$458 - $483",
    "$398 - $423",
]
WORKSHEET_PAIRS = [
    {"label": "Average Price In Market", "value": "$27,222.00"},
    {"label": "Our Selling Price", "value": "$22,995.00"},
    {"label": "Total Savings + Rebate", "value": "$4,227.00"},
    {"label": "Doc Fee", "value": "$999.00"},
    {"label": "Total Taxes", "value": "$1,700.51"},
    {"label": "Electronic Filing Fee", "value": "$299.00"},
    {"label": "Cash Down", "value": "$2,000.00"},
    {"label": "Amount Financed", "value": "$23,993.51"},
]


def test_worksheet_savings_line_is_not_a_rebate_and_taxes_are_a_fee():
    n = normalize(
        raw(
            transcript=WORKSHEET,
            pairs=WORKSHEET_PAIRS,
            fees=[{"label": "Doc Fee", "amount": 999, "kind": "dealer"}],
        )
    )
    assert n["selling_price"] == 22995.0 and n["rebates"] is None
    assert n["amount_financed"] == 23993.51 and n["down"] == 2000.0
    kinds = {f["label"]: f["kind"] for f in n["fees"]}
    assert kinds == {"Doc Fee": "dealer", "Total Taxes": "government", "Electronic Filing Fee": "dealer"}
    assert n["vehicle_text"] == "Brightwater Zenith" and n["year"] == 2025


def test_worksheet_grid_is_options_not_a_term():
    n = normalize(raw(transcript=WORKSHEET, pairs=WORKSHEET_PAIRS))
    assert n["term_months"] is None
    assert n["payment_options"][:2] == [
        {"down": 2000.0, "term_months": 60, "low": 500.0, "high": 525.0},
        {"down": 2000.0, "term_months": 72, "low": 434.0, "high": 459.0},
    ]
    assert len(n["payment_options"]) == 4


STICKER = [
    "DESCRIPTION 2012 / 9900G CT 200h PREMIUM",
    "VIN 1HGCV2FA9SB601815",
    "Compacts range from 10 to 60 MPG",
    "42",
    "MPG",
    "combined city/hwy",
]
STICKER_PAIRS = [
    {"label": "MANUFACTURER'S SUGGESTED RETAIL PRICE", "value": "$ 31,750.00"},
    {"label": "Premium Audio Package Includes:", "value": "1,100.00"},
    {"label": "SUB-TOTAL", "value": "$ 36,888.00"},
    {"label": "DELIVERY, PROCESSING AND HANDLING FEE", "value": "875.00"},
    {"label": "TOTAL", "value": "$ 37,763.00"},
    {"label": "Fuel Economy", "value": "42 MPG"},
]


def test_sticker_total_is_the_msrp_and_nothing_is_a_fee():
    fees = [{"label": "DELIVERY, PROCESSING AND HANDLING FEE", "amount": 875, "kind": "dealer"}]
    n = normalize(raw(doc_type="window_sticker", transcript=STICKER, pairs=STICKER_PAIRS, fees=fees))
    assert n["msrp"] == 37763.0 and n["fees"] == []
    assert n["year"] == 2012 and n["vehicle_text"] == "CT 200h PREMIUM"


def test_mpg_comes_from_the_labelled_pair_not_the_small_print():
    n = normalize(raw(doc_type="window_sticker", transcript=STICKER, pairs=STICKER_PAIRS))
    assert n["epa_combined_mpg"] == 42
    n2 = normalize(raw(doc_type="window_sticker", transcript=STICKER, pairs=[]))
    assert n2["epa_combined_mpg"] == 42  # text fallback skips the "range from" line


def test_make_from_vin_only_with_a_valid_vin():
    assert normalize(raw(transcript=[f"VIN {GOOD_VIN}"]))["make_from_vin"] == "Honda"
    assert normalize(raw(transcript=["VIN 1HGCV2FA0SB601815"]))["make_from_vin"] is None


def test_paired_addons_are_backfilled_even_without_the_word_fee():
    # The hosted model sometimes pairs add-ons but leaves them out of `fees`.
    pairs = [
        {"label": "Selling price", "value": "$28,450.00"},
        {"label": "Nitrogen tire fill", "value": "$199.00"},
        {"label": "Paint and fabric protection", "value": "$995.00"},
        {"label": "Trade allowance", "value": "$4,000.00"},
    ]
    fees = normalize(raw(pairs=pairs, fees=[{"label": "Documentary fee", "amount": 799, "kind": "dealer"}]))[
        "fees"
    ]
    got = {(f["label"], f["amount"], f["kind"]) for f in fees}
    assert got == {
        ("Documentary fee", 799, "dealer"),
        ("Nitrogen tire fill", 199, "addon"),
        ("Paint and fabric protection", 995, "addon"),
    }


def test_vin_split_into_groups_is_joined_only_when_the_check_digit_holds():
    n = normalize(raw(transcript=["VIN JTD LM5RC1TB212233", "MSRP $31,200"]))
    assert n["vin"] == "JTDLM5RC1TB212233" and n["vin_check_ok"]
    n = normalize(raw(transcript=["1HGCV2 FA9SB6 01815 MSRP"]))
    assert n["vin"] == GOOD_VIN and n["vin_check_ok"]
    # 17 characters of ordinary words never become a VIN: the check digit fails.
    n = normalize(raw(transcript=["BASE PRICE 28450 DESTINATION 1095"]))
    assert n["vin"] is None


def test_worksheet_grid_copied_row_by_row_gives_the_same_options():
    rows = [
        "Purchase 60 Months 72 Months",
        "$ Down Est. $/Monthly Est. $/Monthly",
        "$2,000 $500 - $525 $434 - $459",
        "$4,000 $458 - $483 $398 - $423",
        "Our Selling Price $22,995.00",
    ]
    opts = normalize(raw(transcript=rows))["payment_options"]
    assert opts == [
        {"down": 2000.0, "term_months": 60, "low": 500.0, "high": 525.0},
        {"down": 2000.0, "term_months": 72, "low": 434.0, "high": 459.0},
        {"down": 4000.0, "term_months": 60, "low": 458.0, "high": 483.0},
        {"down": 4000.0, "term_months": 72, "low": 398.0, "high": 423.0},
    ]


def test_a_doc_fee_is_a_dealer_fee_even_if_tagged_addon():
    fees = normalize(raw(fees=[{"label": "Documentary fee", "amount": 599, "kind": "addon"}]))["fees"]
    assert fees == [{"label": "Documentary fee", "amount": 599, "kind": "dealer"}]
