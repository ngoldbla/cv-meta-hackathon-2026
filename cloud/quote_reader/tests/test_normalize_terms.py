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


def test_thin_when_fewer_than_two_money_values():
    assert terms_thin(raw(("price", "Price", "$28,450")))
    assert not terms_thin(raw(("price", "Price", "$28,450"), ("apr", "APR", "6.9%")))
    assert terms_thin({"pairs": []})


def test_sticker_base_price_is_not_a_selling_price():
    out = normalize_terms(raw(
        ("msrp", "Total MSRP", "$51,300.00"),
        ("price", "Base price", "$49,500.00"),
    ))
    assert out["selling_price"] is None
    assert out["msrp"] == 51300.0 and out["price_basis"] == "msrp"
