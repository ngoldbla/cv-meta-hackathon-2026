import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from normalize import normalize_terms, terms_thin  # noqa: E402

GOOD_VIN = "1HGCV2FA9SB601815"


def raw(*pairs):
    return {"pairs": [{"kind": k, "label": lab, "value": v} for k, lab, v in pairs]}


def test_buyers_order_terms():
    out = normalize_terms(raw(
        ("price", "Selling Price", "$28,450.00"),
        ("down", "Cash Down", "$3,000"),
        ("apr", "APR", "6.9%"),
        ("term", "Term", "72 mo"),
        ("monthly", "Monthly Payment", "$512.33"),
        ("out_the_door", "Total Cash Price", "$31,204.10"),
        ("mileage", "Odometer", "18,420"),
        ("vin", "VIN", GOOD_VIN),
    ))
    assert out["mode"] == "terms" and out["doc_type"] == "terms"
    assert out["selling_price"] == 28450.0 and out["price_basis"] == "selling"
    assert out["down"] == 3000.0
    assert out["apr"] == 6.9
    assert out["term_months"] == 72
    assert out["stated_monthly"] == 512.33
    assert out["out_the_door"] == 31204.10
    assert out["mileage"] == 18420
    assert out["vin"] == GOOD_VIN and out["vin_check_ok"] is True
    assert out["make_from_vin"] == "Honda"
    assert out["fees"] == [] and out["payment_options"] == []


def test_label_priority_prefers_selling_price():
    out = normalize_terms(raw(
        ("price", "Price", "$30,000"),
        ("price", "Selling Price", "$28,450"),
    ))
    assert out["selling_price"] == 28450.0


def test_sticker_only_price_uses_msrp():
    out = normalize_terms(raw(("msrp", "Total MSRP", "$27,315")))
    assert out["selling_price"] is None
    assert out["msrp"] == 27315.0 and out["price_basis"] == "msrp"


def test_split_vin_is_joined_and_checked():
    out = normalize_terms(raw(("vin", "VIN", "1HGCV2 FA9SB 601815")))
    assert out["vin"] == GOOD_VIN and out["vin_check_ok"] is True


def test_bad_vin_kept_but_flagged():
    out = normalize_terms(raw(("vin", "VIN", "1HGCV2FA0SB601815")))
    assert out["vin"] == "1HGCV2FA0SB601815" and out["vin_check_ok"] is False
    assert out["make_from_vin"] is None


def test_grid_of_terms_is_not_a_term():
    out = normalize_terms(raw(("term", "60 months", "60"), ("term", "72 months", "72")))
    assert out["term_months"] is None


def test_apr_out_of_range_is_dropped():
    out = normalize_terms(raw(("apr", "APR", "69%")))
    assert out["apr"] is None


def test_mileage_digits_only():
    assert normalize_terms(raw(("mileage", "Miles", "18,420 mi")))["mileage"] == 18420
    assert normalize_terms(raw(("mileage", "Miles", "n/a")))["mileage"] is None


def test_thin_only_when_no_money_value():
    # A window sticker can print only its MSRP: with the VIN, that is a complete terms read.
    assert not terms_thin(raw(("msrp", "Total MSRP", "$27,315"), ("vin", "VIN", GOOD_VIN)))
    assert not terms_thin(raw(("price", "Price", "$28,450"), ("apr", "APR", "6.9%")))
    assert terms_thin(raw(("vin", "VIN", GOOD_VIN)))
    assert terms_thin({"pairs": []})


def test_sticker_base_price_is_not_a_selling_price():
    out = normalize_terms(raw(
        ("msrp", "Total MSRP", "$51,300.00"),
        ("price", "Base price", "$49,500.00"),
    ))
    assert out["selling_price"] is None
    assert out["msrp"] == 51300.0 and out["price_basis"] == "msrp"


def test_payment_grid_is_not_a_stated_payment():
    # A dealer's estimate grid ("$500 - $525" per cell) has no single monthly payment.
    out = normalize_terms(raw(
        ("monthly", "Est. $/Monthly", "$500 - $525"),
        ("monthly", "Est. $/Monthly", "$434 - $459"),
        ("price", "Selling Price", "$28,450"),
    ))
    assert out["stated_monthly"] is None
    assert normalize_terms(raw(("monthly", "Payment", "$500 - $525")))["stated_monthly"] is None
    two = normalize_terms(raw(("monthly", "Payment", "$512"), ("monthly", "Payment", "$480")))
    assert two["stated_monthly"] is None


def test_sticker_total_beats_the_base_msrp():
    out = normalize_terms(raw(
        ("msrp", "Manufacturer's suggested retail price", "$31,750.00"),
        ("msrp", "Total", "$37,763.00"),
    ))
    assert out["msrp"] == 37763.0


def test_one_grid_cell_is_not_a_payment_when_terms_form_a_grid():
    out = normalize_terms(raw(
        ("term", "60 Months", "60 Months"),
        ("term", "72 Months", "72 Months"),
        ("monthly", "Est. $/Monthly", "$500"),
    ))
    assert out["term_months"] is None and out["stated_monthly"] is None
