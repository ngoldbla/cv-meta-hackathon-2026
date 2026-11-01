import io
import json

import pandas as pd


def test_travel_targets_by_borough_and_hour():
    from ems.calibrate.travel import travel_targets

    df = pd.DataFrame({"borough": ["BRONX"] * 4, "hour": [1, 1, 1, 2], "travel_s": [100.0, 200.0, 300.0, 50.0]})
    t = travel_targets(df)
    assert t["BRONX"]["1"][50] == 200.0 and t["BRONX"]["2"][0] == 50.0


def test_zip_centroids_from_gazetteer_text():
    from ems.calibrate.travel import zip_centroids

    gaz = "GEOID\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG\n" \
          "10461\t1\t1\t1\t1\t40.847\t-73.840\n99999\t1\t1\t1\t1\t1.0\t2.0\n"
    assert zip_centroids(gaz, {"10461", "10001"}) == {"10461": (40.847, -73.84)}


def test_osrm_table_parses_durations_and_orders_lon_lat():
    from ems.calibrate.travel import osrm_table

    seen = {}

    def opener(u, timeout=0):
        seen["u"] = u
        return io.BytesIO(json.dumps({"code": "Ok", "durations": [[0, 60], [70, 0]]}).encode())

    m = osrm_table([(40.0, -73.0), (40.1, -73.1)], opener=opener)
    assert m.shape == (2, 2) and m[1, 0] == 70 and "-73.0,40.0;-73.1,40.1" in seen["u"]
