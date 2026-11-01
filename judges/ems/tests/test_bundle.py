import json

import numpy as np
import pytest


def test_write_and_verify_bundle(tmp_path):
    from ems.calibrate.bundle import verify_bundle, write_bundle

    m = write_bundle(tmp_path, {"service": {"A": {"n": 1}}, "zips": {"10461": (40.8, -73.8)},
                                "travel_osrm": {"zips": ["10461"], "durations": np.zeros((1, 1))}})
    assert set(m["files"]) == {"service.json", "zips.csv", "travel_osrm.npz"}
    verify_bundle(tmp_path)
    (tmp_path / "service.json").write_text(json.dumps({"A": {"n": 2}}))
    with pytest.raises(ValueError):
        verify_bundle(tmp_path)
