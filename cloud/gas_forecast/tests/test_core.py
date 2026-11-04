import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core import (  # noqa: E402
    DAILY_GPU_CAP,
    DEBOUNCE_S,
    display_name,
    entry_for,
    needs_forecast,
    pre_check,
)

RECORD = {
    "duoarea": "YORD",
    "area_name": "CHICAGO",
    "series": "EMM_EPMR_PTE_YORD_DPG",
    "periods": ["2026-10-26", "2026-11-02"],
    "values": [4.5, 4.6],
}


def test_display_name():
    assert display_name("CHICAGO", "YORD") == "Chicago regular"
    assert display_name("PADD 1C", "R1Z") == "PADD 1C regular"
    assert display_name("U.S.", "NUS") == "U.S. regular"
    assert display_name(None, "R40") == "R40 regular"


def test_entry_for_matches_table_shape():
    q = np.stack([np.full(52, 4.0), np.full(52, 4.5), np.full(52, 5.25)], axis=1)
    e = entry_for(RECORD, [0.1, 0.5, 0.9], q)
    assert e["duoarea"] == "YORD" and e["displayName"] == "Chicago regular"
    assert e["latestPrice"] == 4.6 and e["latestDate"] == "2026-11-02" == e["asOf"]
    f = e["forecast"]
    assert f["horizonWeeks"] == 52 and len(f["p50"]) == 52
    assert (f["meanP10"], f["meanP50"], f["meanP90"]) == (4.0, 4.5, 5.25)


def test_entry_for_picks_levels_by_value_not_position():
    levels = [0.05, 0.1, 0.5, 0.9, 0.95]
    q = np.stack([np.full(52, v) for v in (1, 2, 3, 4, 5)], axis=1)
    f = entry_for(RECORD, levels, q)["forecast"]
    assert (f["meanP10"], f["meanP50"], f["meanP90"]) == (2.0, 3.0, 4.0)


def test_pre_check():
    now = 1_000_000.0
    assert pre_check(None, 0, now, force=False) is None
    assert pre_check(now - DEBOUNCE_S + 1, 0, now, force=False) == "debounced"
    assert pre_check(now - DEBOUNCE_S + 1, 0, now, force=True) is None
    assert pre_check(None, DAILY_GPU_CAP, now, force=True) == "capped"


def test_needs_forecast():
    assert needs_forecast("2026-11-02", None)
    assert needs_forecast("2026-11-02", "2026-10-26")
    assert not needs_forecast("2026-11-02", "2026-11-02")
    assert not needs_forecast(None, "2026-11-02")
