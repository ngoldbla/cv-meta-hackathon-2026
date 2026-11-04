"""Unit tests for lifespan.py (fixture data only; never live calls)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lifespan import (  # noqa: E402
    cost_per_year_of_life,
    load_lifespan_cache,
    miles_from_years,
    years_from_miles,
)


def test_lifespan_conversion_at_twelve_thousand_a_year() -> None:
    # Hand-worked: 204,000 expected miles at 12,000 a year is 17 years.
    assert years_from_miles(204000) == pytest.approx(17.0)
    assert miles_from_years(17) == pytest.approx(204000)
    assert years_from_miles(miles_from_years(13.5)) == pytest.approx(13.5)


def test_cost_per_year_of_life_hand_example() -> None:
    # $34,000 with fees over 17 years is $2,000 a year.
    assert cost_per_year_of_life(34000, 17) == pytest.approx(2000.0)
    with pytest.raises(ValueError, match="must be positive"):
        cost_per_year_of_life(34000, 0)


def test_missing_cache_means_no_lifespans(tmp_path: Path) -> None:
    assert load_lifespan_cache(tmp_path / "absent.json") == {
        "source": None,
        "asOf": None,
        "models": {},
    }


def test_cache_keeps_only_positive_year_figures(tmp_path: Path) -> None:
    path = tmp_path / "lifespan.json"
    path.write_text(
        '{"source": "fixture source", "asOf": "2026-01-01", "models": {'
        '"Corolla": {"years": 11.3, "studyModel": "Toyota Corolla"}, '
        '"Mystery": {"years": 0}}}'
    )
    cache = load_lifespan_cache(path)
    assert cache["source"] == "fixture source"
    assert cache["models"] == {
        "Corolla": {"years": 11.3, "studyModel": "Toyota Corolla"}
    }
