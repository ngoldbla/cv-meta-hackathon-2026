"""Unit tests for trim.py (fixture data only; never live calls)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from trim import (  # noqa: E402
    TrimPrice,
    choose_trim,
    cosmetic_base_name,
    fit_retention_5y,
    guard_triggers,
    merge_cosmetic_variants,
    order_trims,
    trim_retention_from_sold,
)


def test_step_up_orders_by_msrp_and_picks_one_above_base() -> None:
    # Facet/specs order is by count, not price; sorting must recover
    # LE (base) -> SE (step up) -> XSE for the Corolla shape.
    choice = choose_trim(
        [
            TrimPrice("SE", 25365),
            TrimPrice("LE", 22925),
            TrimPrice("XSE", 28840),
        ],
        source="specs",
    )
    assert choice.base_trim == "LE"
    assert choice.step_trim == "SE"
    assert choice.recommended_trim == "SE"
    assert choice.is_step_up is True
    assert choice.step_cost == 2440
    assert choice.guard_hit is False


def test_single_trim_recommends_base_without_step() -> None:
    choice = choose_trim([TrimPrice("LX", 30000)], source="facets")
    assert choice.base_trim == "LX"
    assert choice.recommended_trim == "LX"
    assert choice.is_step_up is False


def test_no_trims_recommends_nothing() -> None:
    choice = choose_trim([], source=None)
    assert choice.base_trim is None
    assert choice.recommended_trim is None


def test_retention_guard_drops_to_base_when_step_keeps_much_less() -> None:
    # Model keeps 68%; the step trim keeps 60% (8 points worse, over
    # the 3-point guard), so the base trim is recommended instead.
    choice = choose_trim(
        [TrimPrice("LE", 22925), TrimPrice("SE", 25365)],
        source="specs",
        model_retention_5y=0.68,
        trim_retention_5y=0.60,
    )
    assert choice.guard_hit is True
    assert choice.step_trim == "SE"
    assert choice.recommended_trim == "LE"
    assert choice.is_step_up is False


def test_retention_guard_keeps_step_within_three_points() -> None:
    assert guard_triggers(0.68, 0.66) is False
    # Exactly 3 points worse is not "more than 3 points" worse.
    assert guard_triggers(0.68, 0.65) is False
    assert guard_triggers(0.68, 0.649) is True
    choice = choose_trim(
        [TrimPrice("LE", 22925), TrimPrice("SE", 25365)],
        source="specs",
        model_retention_5y=0.68,
        trim_retention_5y=0.66,
    )
    assert choice.recommended_trim == "SE"
    assert choice.guard_hit is False


def test_guard_unmeasurable_keeps_step() -> None:
    # No trim fit (too few sold units): the guard cannot trigger.
    assert guard_triggers(0.68, None) is False
    choice = choose_trim(
        [TrimPrice("LE", 22925), TrimPrice("SE", 25365)],
        source="specs",
        model_retention_5y=0.68,
        trim_retention_5y=None,
    )
    assert choice.recommended_trim == "SE"


def test_trim_retention_needs_thirty_per_age_and_three_ages() -> None:
    sold = {
        1: (100, 21000.0),
        2: (100, 20000.0),
        3: (29, 19000.0),  # under 30: excluded
        4: (100, 18000.0),
    }
    # Three qualifying ages (1, 2, 4) against a $25k new price fit.
    fitted = trim_retention_from_sold(sold, 25000)
    assert fitted is not None
    manual = fit_retention_5y([(1, 21000 / 25000), (2, 20000 / 25000), (4, 18000 / 25000)])
    assert fitted == pytest.approx(manual)  # type: ignore[arg-type]
    thin = {1: (100, 21000.0), 2: (100, 20000.0), 3: (10, 19000.0)}
    assert trim_retention_from_sold(thin, 25000) is None
    assert trim_retention_from_sold(sold, None) is None


def test_cosmetic_variant_is_not_a_trim_step_venue() -> None:
    # Venue shape (task 031): SE -> SEL, not "SEL w/ 2-Tone Roof".
    choice = choose_trim(
        [
            TrimPrice("SE", 21390),
            TrimPrice("SEL w/ 2-Tone Roof", 23440),
            TrimPrice("SEL", 23950),
            TrimPrice("Limited", 25990),
        ],
        source="specs",
    )
    assert choice.base_trim == "SE"
    assert choice.step_trim == "SEL"
    assert choice.recommended_trim == "SEL"
    # The merged SEL keeps its cheapest variant's MSRP.
    assert choice.recommended_msrp == 23440


def test_only_higher_variant_cosmetic_falls_back_to_next_real_trim() -> None:
    merged, merges = merge_cosmetic_variants(
        [
            TrimPrice("LE", 22925),
            TrimPrice("LE Black Edition", 23800),
            TrimPrice("SE", 25365),
        ]
    )
    assert [t.trim for t in order_trims(merged)] == ["LE", "SE"]
    assert merges == [("LE Black Edition", "LE", 22925)]
    choice = choose_trim(
        [
            TrimPrice("LE", 22925),
            TrimPrice("LE Black Edition", 23800),
            TrimPrice("SE", 25365),
        ],
        source="specs",
    )
    assert choice.recommended_trim == "SE"


def test_drivetrain_variant_is_not_merged() -> None:
    assert cosmetic_base_name("LX AWD") is None
    assert cosmetic_base_name("SEL w/ 2-Tone Roof") == "SEL"
    merged, merges = merge_cosmetic_variants(
        [TrimPrice("LX", 30000), TrimPrice("LX AWD", 31500), TrimPrice("EX", 33000)]
    )
    assert merges == []
    assert [t.trim for t in order_trims(merged)] == ["LX", "LX AWD", "EX"]
    choice = choose_trim(
        [TrimPrice("LX", 30000), TrimPrice("LX AWD", 31500), TrimPrice("EX", 33000)],
        source="specs",
    )
    assert choice.recommended_trim == "LX AWD"


def test_order_trims_drops_unpriced_rows() -> None:
    ordered = order_trims(
        [TrimPrice("SE", 25000), TrimPrice("", 1), TrimPrice("LE", 23000)]
    )
    assert [t.trim for t in ordered] == ["LE", "SE"]
