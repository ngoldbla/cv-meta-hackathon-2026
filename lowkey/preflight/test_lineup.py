"""Unit tests for lineup.py (fixture data only; never live calls).

Cover the brand rule in both its forms, the heavy-duty exclusion,
the commodity badge/extra flag, the 15% trade-in discount, the
30-per-age eligibility rule and a category short of picks.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lineup import (  # noqa: E402
    ModelFit,
    depreciation_per_month,
    is_heavy_duty,
    rank_category,
)


def fit(
    model: str,
    make: str,
    retention: float | None,
    price: float | None,
    ages: dict[int, int] | None = None,
) -> ModelFit:
    return ModelFit(
        model=model,
        make=make,
        retention_5y=retention,
        new_price=price,
        ages=ages or {1: 100, 2: 100, 3: 100, 4: 100, 5: 100},
    )


def test_trade_in_discount_arithmetic() -> None:
    # 0.85 factor: $30k car retaining 0.80 retail keeps 0.68 adjusted,
    # losing 0.32 * 30000 / 60 = $160 a month.
    assert depreciation_per_month(30000, 0.80) == pytest.approx(160.0)


def test_brand_rule_two_pick_replaces_same_make() -> None:
    # Task 023 form: #1 and #2 must be different makes.
    models = [
        fit("Accord Sedan", "Honda", 0.77, 31000),
        fit("Civic Sedan", "Honda", 0.76, 28000),
        fit("Mazda3 Sedan", "Mazda", 0.73, 27000),
    ]
    lineup = rank_category("Sedan", models, top_k=2, max_per_make=1)
    assert [p.model for p in lineup.picks] == ["Accord Sedan", "Mazda3 Sedan"]
    assert lineup.skipped_same_make == ["Civic Sedan"]


def test_third_same_make_model_is_skipped() -> None:
    # Current PRD form: no make holds more than 2 of the 4 slots.
    models = [
        fit("A1", "Honda", 0.80, 30000),
        fit("A2", "Honda", 0.79, 30000),
        fit("A3", "Honda", 0.78, 30000),
        fit("B1", "Toyota", 0.77, 30000),
        fit("C1", "Mazda", 0.76, 30000),
    ]
    lineup = rank_category("Sedan", models, top_k=4, max_per_make=2)
    assert [p.model for p in lineup.picks] == ["A1", "A2", "B1", "C1"]
    assert lineup.skipped_same_make == ["A3"]
    assert lineup.makes == ["Honda", "Mazda", "Toyota"]


def test_heavy_duty_pickups_excluded() -> None:
    assert is_heavy_duty("Pickup", "F-250")
    assert is_heavy_duty("Pickup", "F-350 Super Duty")
    assert is_heavy_duty("Pickup", "Silverado 2500HD")
    assert is_heavy_duty("Pickup", "Sierra 3500HD")
    assert is_heavy_duty("Pickup", "2500")  # bare Ram value
    assert is_heavy_duty("Pickup", "3500")
    assert not is_heavy_duty("Pickup", "Tacoma")
    assert not is_heavy_duty("Pickup", "1500")  # light-duty Ram
    assert not is_heavy_duty("Sedan", "2500")  # rule is pickup-only

    models = [
        fit("F-350", "Ford", 0.90, 59000),
        fit("Tacoma", "Toyota", 0.75, 46000),
        fit("1500", "Ram", 0.72, 55000),
    ]
    lineup = rank_category("Pickup", models, top_k=4, max_per_make=2)
    assert [p.model for p in lineup.picks] == ["Tacoma", "1500"]
    assert lineup.excluded_heavy_duty == ["F-350"]


def test_commodity_pick_badged_when_among_picks() -> None:
    models = [
        fit("Keeper", "Honda", 0.80, 28000),  # best retention, cheapest too
        fit("Plain", "Toyota", 0.70, 40000),
    ]
    lineup = rank_category("Sedan", models, top_k=4, max_per_make=2)
    assert lineup.commodity is not None
    assert lineup.commodity.model == "Keeper"
    assert lineup.commodity_flag == "badge"


def test_commodity_pick_extra_when_outside_picks() -> None:
    models = [
        fit("R1", "Honda", 0.80, 50000),
        fit("R2", "Toyota", 0.79, 50000),
        fit("Cheap", "Hyundai", 0.60, 20000),  # low retention, low rent
    ]
    lineup = rank_category("Sedan", models, top_k=2, max_per_make=1)
    assert [p.model for p in lineup.picks] == ["R1", "R2"]
    assert lineup.commodity is not None
    assert lineup.commodity.model == "Cheap"
    assert lineup.commodity_flag == "extra"


def test_fewer_than_four_qualifying_models() -> None:
    models = [
        fit("Only1", "Honda", 0.80, 30000),
        fit("Only2", "Toyota", 0.75, 30000),
        fit("Thin", "Mazda", 0.90, 30000, ages={1: 100, 2: 100}),  # <3 ages
        fit("NoPrice", "Kia", 0.85, None),
    ]
    lineup = rank_category("Sedan", models, top_k=4, max_per_make=2)
    assert [p.model for p in lineup.picks] == ["Only1", "Only2"]


def test_rankable_model_without_make_is_refused() -> None:
    models = [fit("Mystery", None, 0.90, 30000)]  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="no resolved make"):
        rank_category("Sedan", models, top_k=4, max_per_make=2)


def test_thin_age_blocks_ranking() -> None:
    # An age under 30 does not count as fitted; 3 such ages are needed.
    models = [
        fit("Sparse", "Honda", 0.90, 30000, ages={1: 10, 2: 100, 3: 100}),
        fit("Solid", "Toyota", 0.70, 30000),
    ]
    lineup = rank_category("Sedan", models, top_k=4, max_per_make=2)
    assert [p.model for p in lineup.picks] == ["Solid"]


def test_reserve_pulls_best_toyota_into_top_four() -> None:
    # Task 029, part 0: without the reserve the top four would be
    # Honda/Mazda/Hyundai/Kia; the best Toyota (5th by retention)
    # must displace the 4th pick, and the four stay ordered by
    # retention.
    models = [
        fit("Accord Sedan", "Honda", 0.80, 31000),
        fit("Mazda3 Sedan", "Mazda", 0.78, 27000),
        fit("Elantra", "Hyundai", 0.76, 25000),
        fit("K5", "Kia", 0.75, 30000),
        fit("Corolla", "Toyota", 0.70, 28000),
    ]
    lineup = rank_category("Sedan", models, top_k=4, max_per_make=2)
    assert [p.model for p in lineup.picks] == [
        "Accord Sedan",
        "Mazda3 Sedan",
        "Elantra",
        "Corolla",
    ]
    assert lineup.missing_brands == []


def test_reserve_respects_two_per_make_cap() -> None:
    # Task 029, part 0: the reserved Toyota counts toward the cap, so
    # a third Toyota is skipped even though it out-retains the Mazda,
    # and the reserved Honda still takes a slot.
    models = [
        fit("T1", "Toyota", 0.90, 30000),
        fit("T2", "Toyota", 0.89, 30000),
        fit("T3", "Toyota", 0.88, 30000),
        fit("M1", "Mazda", 0.87, 30000),
        fit("H1", "Honda", 0.60, 30000),
    ]
    lineup = rank_category("Sedan", models, top_k=4, max_per_make=2)
    assert [p.model for p in lineup.picks] == ["T1", "T2", "M1", "H1"]
    assert lineup.skipped_same_make == ["T3"]
    assert lineup.missing_brands == []


def test_missing_honda_records_shortfall_and_fills_normally() -> None:
    # Task 029, part 0: no qualifying Honda (its only model is too
    # thin to rank) records the shortfall; the rest fill by retention.
    models = [
        fit("Corolla", "Toyota", 0.80, 28000),
        fit("Mazda3 Sedan", "Mazda", 0.78, 27000),
        fit("Elantra", "Hyundai", 0.76, 25000),
        fit("K5", "Kia", 0.75, 30000),
        fit("Thin Honda", "Honda", 0.90, 30000, ages={1: 100, 2: 100}),
    ]
    lineup = rank_category("Sedan", models, top_k=4, max_per_make=2)
    assert lineup.missing_brands == ["Honda"]
    assert [p.model for p in lineup.picks] == [
        "Corolla",
        "Mazda3 Sedan",
        "Elantra",
        "K5",
    ]


def test_pickup_lineup_is_unchanged_by_reserve() -> None:
    # Task 029, part 0: pickups never reserve and never record a
    # shortfall, even with no Honda present.
    models = [
        fit("Tacoma", "Toyota", 0.80, 46000),
        fit("1500", "Ram", 0.75, 55000),
        fit("Colorado", "Chevrolet", 0.70, 42000),
        fit("Ranger", "Ford", 0.68, 41000),
    ]
    lineup = rank_category("Pickup", models, top_k=4, max_per_make=2)
    assert [p.model for p in lineup.picks] == [
        "Tacoma",
        "1500",
        "Colorado",
        "Ranger",
    ]
    assert lineup.missing_brands == []


def test_hybrid_lineup_reserves_a_toyota_and_a_honda() -> None:
    # Task 042: the Toyota+Honda rule applies to Hybrid (both make
    # many full hybrids); a Honda below three other makes still gets in.
    models = [
        fit("Maverick", "Ford", 0.75, 35000),
        fit("Elantra Hybrid", "Hyundai", 0.74, 29000),
        fit("Niro", "Kia", 0.73, 31000),
        fit("Corolla Hybrid", "Toyota", 0.72, 29500),
        fit("CR-V", "Honda", 0.68, 40800),
    ]
    lineup = rank_category("Hybrid", models)
    makes = [p.make for p in lineup.picks]
    assert "Toyota" in makes and "Honda" in makes
    assert [p.model for p in lineup.picks] == [
        "Maverick", "Elantra Hybrid", "Corolla Hybrid", "CR-V",
    ]
    assert lineup.missing_brands == []


def test_minivan_lineup_has_no_reserve() -> None:
    # Task 042: Minivan is unchanged by the Toyota+Honda rule.
    models = [
        fit("Carnival", "Kia", 0.66, 42700),
        fit("Pacifica", "Chrysler", 0.65, 47000),
        fit("Voyager", "Chrysler", 0.64, 41000),
        fit("Grand Caravan", "Ford", 0.63, 40000),
        fit("Odyssey", "Honda", 0.60, 45800),
    ]
    lineup = rank_category("Minivan", models)
    assert "Honda" not in [p.make for p in lineup.picks]
    assert lineup.missing_brands == []


def test_new_category_short_of_four_shows_fewer_without_relaxing() -> None:
    # Task 042: a category that cannot fill four shows fewer; a model
    # under 30 sold units at a fitted age never fills the gap.
    thin = {1: 29, 2: 29, 3: 100, 4: 100, 5: 29}
    models = [
        fit("Sienna", "Toyota", 0.70, 54000),
        fit("Odyssey", "Honda", 0.65, 45800),
        fit("Carnival", "Kia", 0.63, 42700),
        fit("Thin Van", "Ford", 0.80, 40000, ages=thin),
    ]
    lineup = rank_category("Minivan", models)
    assert [p.model for p in lineup.picks] == ["Sienna", "Odyssey", "Carnival"]


def test_age_points_reach_the_table_dict() -> None:
    """Task 057: the sold-price ratio by age (>= 30 sold) and the fit's slope travel to the table."""
    import lineup
    analysis = {"models": {c: {} for c in lineup.CATEGORIES}}
    analysis["models"]["Sedan"]["Corolla"] = {
        "new_price": 24000.0,
        "fit": {"retention_5y": 0.62, "slope_per_year": -0.09},
        "ages": {
            "1": {"count": 120, "ret_new": 0.86},
            "2": {"count": 90, "ret_new": 0.79},
            "3": {"count": 12, "ret_new": 0.70},
        },
    }
    fits = lineup.load_model_fits(analysis, {"Sedan": {"Corolla": "Toyota"}})
    m = next(f for f in fits["Sedan"] if f.model == "Corolla")
    assert m.ret_by_age == {1: 0.86, 2: 0.79}  # age 3 has fewer than 30 sales
    assert m.slope_per_year == -0.09
