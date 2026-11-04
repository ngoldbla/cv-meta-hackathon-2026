"""EPA MPG lookup (fixture rows only; never live calls)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_table import EPA_MODELS, EPA_OVERRIDES, epa_variants, lookup_mpg  # noqa: E402


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


def hybrid_row(id_: str, make: str, model: str, drive: str, displ: str, mpg: str, year: str = "2026") -> dict:
    r = row(id_, make, model, drive, displ, mpg)
    r.update({"year": year, "atvType": "Hybrid", "eng_dscr": "SIDI; Hybrid", "evMotor": "288V Ni-MH", "cylinders": "4"})
    return r


# Shapes from the EPA vehicles.csv (2026 Honda CR-V, Kia Carnival).
CRV_ROWS = [
    {**row("49352", "Honda", "CR-V FWD", "Front-Wheel Drive", "1.5", "30"), "tCharger": "T", "cylinders": "4", "atvType": ""},
    hybrid_row("49353", "Honda", "CR-V FWD", "Front-Wheel Drive", "2.0", "40"),
    {**row("49487", "Honda", "CR-V AWD", "All-Wheel Drive", "1.5", "29"), "tCharger": "T", "cylinders": "4", "atvType": ""},
    hybrid_row("49488", "Honda", "CR-V AWD", "All-Wheel Drive", "2.0", "37"),
]
CARNIVAL_ROWS = [
    {**row("49437", "Kia", "Carnival", "Front-Wheel Drive", "3.5", "21"), "cylinders": "6", "atvType": ""},
    {**hybrid_row("49438", "Kia", "Carnival Hybrid", "Front-Wheel Drive", "1.6", "32"), "tCharger": "T"},
]


def test_hybrid_category_rates_the_hybrid_cr_v() -> None:
    # Task 042: the same provider model is a different powertrain in
    # the Hybrid lineup; the gas SUV keeps its gas figure.
    assert lookup_mpg(CRV_ROWS, 2026, "CR-V", "Honda", "Hybrid")["mpg"] == 37.0
    assert lookup_mpg(CRV_ROWS, 2026, "CR-V", "Honda", "SUV")["mpg"] == 29.0


def test_minivan_uses_gas_rows_when_the_model_is_sold_as_gas() -> None:
    # "Carnival" prefixes "Carnival Hybrid"; the provider's Carnival
    # is the gas van, so the gas row wins.
    assert lookup_mpg(CARNIVAL_ROWS, 2026, "Carnival", "Kia", "Minivan")["mpg"] == 21.0


def test_variants_carry_drive_engine_and_powertrain() -> None:
    variants = epa_variants(CARNIVAL_ROWS, 2026, "Carnival", "Kia", "Minivan")
    assert [(v["epaId"], v["drive"], v["displ"], v["cyl"], v["turbo"], v["hybrid"], v["mpg"]) for v in variants] == [
        ("49437", ["FWD"], 3.5, 6, False, False, 21.0),
        ("49438", ["FWD"], 1.6, 4, True, True, 32.0),
    ]
    hybrid = epa_variants(CRV_ROWS, 2026, "CR-V", "Honda", "Hybrid")
    assert [v["epaId"] for v in hybrid] == ["49353", "49488"]
