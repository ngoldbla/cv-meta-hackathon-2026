"""ZIP3 -> state coverage (task 040, confirmed fix 2).

The table must be complete for every assigned USPS prefix, so the
"Tax not included: unknown state" line is rare. No live calls.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from p15_gas import ZIP3_RANGES, zip_to_state  # noqa: E402

# USPS prefixes that are not assigned to any delivery area.
UNASSIGNED = {
    99, 269, 428, 429, 529, 568, 578, 579, 589, 659, 694, 695, 696,
    697, 698, 699, 715, 817, 818, 819, 839, 848, 849, 866, 867, 868,
    869, 886, 887, 888, 899,
}


def test_ranges_do_not_overlap() -> None:
    seen: dict[int, str] = {}
    for lo, hi, state in ZIP3_RANGES:
        assert lo <= hi
        for prefix in range(lo, hi + 1):
            assert prefix not in seen, f"{prefix:03d} in {seen.get(prefix)} and {state}"
            seen[prefix] = state


def test_every_assigned_prefix_maps() -> None:
    missing = [
        f"{p:03d}"
        for p in range(5, 1000)
        if p not in UNASSIGNED and zip_to_state(f"{p:03d}01") is None
    ]
    assert missing == []


@pytest.mark.parametrize(
    ("zip_code", "state"),
    [
        ("05501", "MA"),  # Andover IRS prefix, once left unmapped
        ("39901", "GA"),
        ("60614", "IL"),
        ("00802", "VI"),
        ("00901", "PR"),
        ("09001", "AE"),
        ("34001", "AA"),
        ("96201", "AP"),
        ("88901", "NV"),
        ("96910", "GU"),
    ],
)
def test_known_zips(zip_code: str, state: str) -> None:
    assert zip_to_state(zip_code) == state
