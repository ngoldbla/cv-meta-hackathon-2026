import numpy as np
import pandas as pd


def test_concurrency_counts_half_open_intervals():
    from ems.calibrate.fleet import concurrency_at

    s, e = np.array([0, 5, 10]), np.array([10, 15, 20])
    assert list(concurrency_at(s, e, np.array([0, 5, 9, 10, 15, 19, 20]))) == [1, 2, 2, 2, 1, 1, 0]


def test_fit_fleet_recovers_a_capacity_of_ten():
    from ems.calibrate.fleet import fit_fleet

    rng = np.random.default_rng(1)
    rows, busy_until, t = [], [], 0.0
    while t < 10 * 86400:  # an M/M/10 queue at 60% load; calls are held when all 10 units are busy
        t += rng.exponential(100)
        busy_until = [b for b in busy_until if b > t]
        held = len(busy_until) >= 10
        start = min(busy_until) if held else t
        if held:
            busy_until.remove(start)
        end = start + rng.exponential(600)
        busy_until.append(end)
        rows.append({"borough": "BRONX", "t_call": t, "t_assign": start, "t_close": end, "held": held})
    df = pd.DataFrame(rows)
    for c in ("t_call", "t_assign", "t_close"):
        df[c] = pd.Timestamp("2019-01-01") + pd.to_timedelta(df[c], unit="s")
    fit = fit_fleet(df)
    meds = [v["median"] for v in fit["BRONX"].values() if v["n_onsets"] >= 3]
    assert meds and abs(np.median(meds) - 10) <= 1
