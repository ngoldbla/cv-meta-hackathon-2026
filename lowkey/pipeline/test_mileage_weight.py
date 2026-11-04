"""Unit tests for mileage_weight.py (task 057; pure maths, never live calls)."""

from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mileage_weight import cell_weight, decide  # noqa: E402


def test_cell_weight_matches_the_formula() -> None:
    # 2-year-old car: halves at 18k and 30k miles (midpoints), a 12k gap = 1 typical year.
    # The low half sells for e^0.09 more; slope -0.09/yr -> 12k extra miles = 1 extra year -> w = 1.
    w = cell_weight(p_low=10_000 * math.exp(0.09), p_high=10_000, slope=-0.09, m_low=18_000, m_high=30_000)
    assert w is not None and abs(w - 1.0) < 1e-9


def test_cell_weight_none_for_flat_slope_or_bad_prices() -> None:
    assert cell_weight(11_000, 10_000, 0.0, 18_000, 30_000) is None
    assert cell_weight(None, 10_000, -0.09, 18_000, 30_000) is None


def test_decide_accepts_a_tight_positive_set() -> None:
    out = decide([0.5, 0.6, 0.7, 0.55, 0.65, 0.6, 0.62, 0.58])
    assert out["accepted"] and abs(out["weight"] - 0.6) < 0.01


def test_decide_rejects_too_few_cells_or_out_of_range() -> None:
    assert decide([0.6] * 7)["accepted"] is False
    assert decide([2.0] * 9)["accepted"] is False
    assert decide([-0.5, 0.6, -0.4, 0.7, -0.3, 0.5, 0.6, -0.2])["accepted"] is False
    assert decide([0.6] * 7)["weight"] == 0
