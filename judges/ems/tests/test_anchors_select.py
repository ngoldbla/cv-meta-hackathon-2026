from datetime import date, timedelta

import numpy as np
import pandas as pd


def _daily():
    days = [date(2017, 12, 1) + timedelta(d) for d in range(31 + 365 + 365)]  # 2017-12-01 .. 2019-12-31
    n = [4000] * len(days)
    for k in range(11, 18):  # 2018-01-11..17 are a surge
        n[days.index(date(2018, 1, k))] = 5000 + k
    return pd.DataFrame({"day": days, "n": n})


def test_anchor_selection_rules():
    from ems.calibrate.anchors import fit_days, select_anchor_days

    a = select_anchor_days(_daily())
    assert sorted(a["flu_2018"]) == [date(2018, 1, k).isoformat() for k in range(11, 18)]
    assert all(date.fromisoformat(d).year == 2019 and date.fromisoformat(d).toordinal() % 6 == 0 for d in a["normal_2019"])
    assert 58 <= len(a["normal_2019"]) <= 62
    fd = fit_days(set(_daily()["day"]), a)
    assert not fd & {date.fromisoformat(d) for d in a["flu_2018"] + a["normal_2019"]}


def test_anchor_targets_compute_tiers_held_transports_offload_and_flu_increase():
    from ems.calibrate.anchors import anchor_targets

    rows = []
    for d in (date(2019, 1, 6), date(2019, 1, 12)):
        for t, r in ((1, 300.0), (1, 600.0), (2, 900.0), (3, 1200.0)):
            rows.append({"day": d, "tier": t, "held": t == 3, "transported": t < 3, "response_s": r,
                         "offload_s": 1800.0 if t < 3 else np.nan})
    for k in range(1, 30):
        d = date(2017, 12, 13) + timedelta(k)
        rows.append({"day": d, "tier": 2, "held": d >= date(2018, 1, 11), "transported": False, "response_s": 1.0,
                     "offload_s": np.nan})
    df = pd.DataFrame(rows)
    anchor = {"normal_2019": ["2019-01-06", "2019-01-12"], "flu_2018": ["2018-01-11"]}
    t = anchor_targets(df, anchor)
    assert t["normal"]["tiers"]["1"]["p50_min"] == 7.5 and t["normal"]["held_share"] == 0.25
    assert t["normal"]["transports_per_day"] == 3.0 and t["normal"]["offload_median_min"] == 30.0
    assert t["flu"]["held_share_increase"] == 1.0
