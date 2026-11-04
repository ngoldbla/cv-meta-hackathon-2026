import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from eia import newest_period, record_from_rows  # noqa: E402

ROWS = [
    {"period": "2026-10-19", "area-name": "CHICAGO", "series": "S", "value": "4.40"},
    {"period": "2026-10-26", "area-name": "CHICAGO", "series": "S", "value": None},
    {"period": "2026-11-02", "area-name": "CHICAGO", "series": "S", "value": "4.61"},
]


def test_record_drops_missing_values_pairwise():
    r = record_from_rows("YORD", ROWS)
    assert r["periods"] == ["2026-10-19", "2026-11-02"]
    assert r["values"] == [4.40, 4.61]
    assert r["area_name"] == "CHICAGO" and r["series"] == "S" and r["duoarea"] == "YORD"


def test_record_empty_rows():
    r = record_from_rows("YORD", [])
    assert r["periods"] == [] and r["area_name"] is None


def test_newest_period():
    a = {"periods": ["2026-10-26"]}
    b = {"periods": ["2026-11-02"]}
    assert newest_period({"A": a, "B": b}) == "2026-11-02"
    assert newest_period({"C": {"periods": []}}) is None
