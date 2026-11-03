"""Tests for tax_table (task 037, P19). Fixture rules only."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import tax_table

FOUNDATION = {"title": "Fixture foundation", "url": "https://example.com/tf", "accessed": "2026-11-03"}


def _rule(state: str, **over: object) -> dict:
    base = {
        "state": state,
        "name": state,
        "kind": "sales",
        "label": f"{state} sales tax",
        "stateRate": 0.05,
        "avgLocalRate": 0.01,
        "cap": None,
        "localBaseCap": None,
        "flatAdd": 0,
        "vehicleAddRate": 0,
        "base": "price_with_fees",
        "note": "",
        "sourceUrl": "https://example.com/state",
        "sourceDate": "2026-11-03",
    }
    base.update(over)
    return base


def _doc(states: dict) -> dict:
    return {"version": 1, "asOf": "2026-11-03", "taxFoundation": FOUNDATION, "states": states}


def _full_states() -> dict:
    codes = [a + b for a in "ABCDEFGH" for b in "ABCDEFGH"][:47]
    states = {code: _rule(code) for code in codes}
    # 47 two-letter fixture codes + the four task fixtures = 51.
    states["IL"] = _rule("IL", stateRate=0.0625, avgLocalRate=0.0273)
    states["GA"] = _rule("GA", kind="tavt", stateRate=0.07, avgLocalRate=0)
    states["NC"] = _rule("NC", kind="hut", stateRate=0.03, avgLocalRate=0)
    states["MT"] = _rule("MT", kind="none", stateRate=0, avgLocalRate=0)
    return states


def test_percentage_state_math() -> None:
    rule = _full_states()["IL"]
    # 6.25% state + 2.73% average local on the price with fees.
    assert tax_table.tax_amount(rule, 20000) == 20000 * 0.0898


def test_georgia_tavt_and_nc_hut() -> None:
    states = _full_states()
    assert tax_table.tax_amount(states["GA"], 30000) == 2100
    assert tax_table.tax_amount(states["NC"], 30000) == 900


def test_no_tax_state_is_zero() -> None:
    assert tax_table.tax_amount(_full_states()["MT"], 50000) == 0


def test_cap_and_local_base_cap() -> None:
    capped = _rule("SC", kind="imf", stateRate=0.05, avgLocalRate=0, cap=500)
    assert tax_table.tax_amount(capped, 40000) == 500
    assert tax_table.tax_amount(capped, 8000) == 400
    fl = _rule("FL", stateRate=0.06, avgLocalRate=0.01, localBaseCap=5000)
    assert tax_table.tax_amount(fl, 40000) == 40000 * 0.06 + 5000 * 0.01


def test_dc_bands_use_mpg() -> None:
    dc = _rule(
        "DC",
        kind="dc",
        stateRate=0,
        avgLocalRate=0,
        mpgBands=[
            {"maxMpg": 20, "rate": 0.10},
            {"maxMpg": 30, "rate": 0.041},
            {"maxMpg": None, "rate": 0.025},
        ],
    )
    assert tax_table.tax_amount(dc, 30000, mpg=29) == 30000 * 0.041
    assert tax_table.tax_amount(dc, 30000, mpg=18) == 30000 * 0.10


def test_loader_requires_all_states_and_sources(tmp_path: Path) -> None:
    good = tmp_path / "good.json"
    good.write_text(json.dumps(_doc(_full_states())))
    loaded = tax_table.load_tax_rules(good)
    assert len(loaded["states"]) == 51
    assert loaded["states"]["GA"]["kind"] == "tavt"

    short = tmp_path / "short.json"
    states = _full_states()
    del states["IL"]
    short.write_text(json.dumps(_doc(states)))
    assert tax_table.load_tax_rules(short)["states"] == {}

    no_source = tmp_path / "nosource.json"
    states = _full_states()
    states["IL"] = _rule("IL", sourceUrl="")
    no_source.write_text(json.dumps(_doc(states)))
    assert tax_table.load_tax_rules(no_source)["states"] == {}

    missing = tax_table.load_tax_rules(tmp_path / "absent.json")
    assert missing["states"] == {}
