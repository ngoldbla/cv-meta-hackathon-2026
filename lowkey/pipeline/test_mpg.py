"""EPA MPG lookup (fixture rows only; never live calls)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_table import EPA_MODELS, EPA_OVERRIDES, lookup_mpg  # noqa: E402


def row(id_: str, make: str, model: str, drive: str, displ: str, mpg: str, fuel: str = "Regular") -> dict:
    return {
        "id": id_,
        "year": "2026",
        "make": make,
        "model": model,
        "drive": drive,
        "displ": displ,
        "fuelType": fuel,
        "comb08": mpg,
        "trany": "Automatic (S8)",
        "eng_dscr": "",
        "evMotor": "",
        "tCharger": "",
    }


# Shapes from the EPA vehicles.csv (2026 GMC Sierra rows).
SIERRA_ROWS = [
    row("49364", "GMC", "Sierra 2WD", "Rear-Wheel Drive", "2.7", "20"),
    row("49401", "GMC", "Sierra 4WD", "4-Wheel Drive", "2.7", "18"),
    row("49400", "GMC", "Sierra Mud Terrain Tires 4WD", "4-Wheel Drive", "2.7", "17"),
    row("49406", "GMC", "Sierra 4WD", "4-Wheel Drive", "6.2", "16", fuel="Premium"),
    row("49709", "GMC", "Sierra EV", "4-Wheel Drive", "", "64", fuel="Electricity"),
]


def test_sierra_1500_maps_to_the_epa_sierra_base_4wd() -> None:
    # The provider says "Sierra 1500"; the EPA says "Sierra". Without
    # the map the Sierra had no MPG and so no gas cost (report 041).
    found = lookup_mpg(SIERRA_ROWS, 2026, "Sierra 1500", "GMC")
    assert found is not None
    assert found["epaId"] == "49401"
    assert found["mpg"] == 18.0


def test_unmapped_provider_name_finds_nothing() -> None:
    assert lookup_mpg(SIERRA_ROWS, 2026, "Sierra 3500HD", "GMC") is None


def test_every_override_has_a_model_map() -> None:
    assert set(EPA_OVERRIDES) <= set(EPA_MODELS)
