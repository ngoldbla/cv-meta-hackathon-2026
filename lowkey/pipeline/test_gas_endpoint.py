import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gas_endpoint import gas_from_payload  # noqa: E402


def entry(d, latest="2026-11-02"):
    return {"duoarea": d, "latestDate": latest, "forecast": {"meanP50": 4.0}}


PAYLOAD = {
    "builtAt": "2026-11-03T10:00:00Z",
    "eiaAsOf": "2026-11-02",
    "model": "mistralai/Timestral-28M",
    "horizonWeeks": 52,
    "series": {"YORD": entry("YORD"), "NUS": entry("NUS")},
}


def test_gas_from_payload():
    series, source = gas_from_payload(PAYLOAD, {"YORD", "NUS"})
    assert set(series) == {"YORD", "NUS"}
    assert source == {
        "model": "mistralai/Timestral-28M",
        "asOf": "2026-11-03",
        "horizonWeeks": 52,
        "service": "modal",
    }


def test_missing_series_fails_loudly():
    with pytest.raises(SystemExit, match="R40"):
        gas_from_payload(PAYLOAD, {"YORD", "NUS", "R40"})


def test_missing_forecast_fails_loudly():
    bad = {**PAYLOAD, "series": {"YORD": {**entry("YORD"), "forecast": None}}}
    with pytest.raises(SystemExit, match="YORD"):
        gas_from_payload(bad, {"YORD"})
