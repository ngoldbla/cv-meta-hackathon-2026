import numpy as np
import pandas as pd
import pytest


def test_prior_load_counts_arrivals_in_window():
    from ems.calibrate.offload import prior_load

    t = pd.to_datetime(["2019-01-01 10:00", "2019-01-01 10:30", "2019-01-01 13:00"])
    df = pd.DataFrame({"borough": "BRONX", "t_hosp": t, "transported": True})
    assert list(prior_load(df)) == [0, 1, 0]


def test_fit_offload_recovers_a_known_load_slope():
    from ems.calibrate.offload import fit_offload

    rng = np.random.default_rng(0)
    n = 20000
    t = pd.Timestamp("2019-01-01") + pd.to_timedelta(np.sort(rng.uniform(0, 30 * 86400, n)), unit="s")
    df = pd.DataFrame({"borough": "QUEENS", "t_hosp": t, "transported": True})
    from ems.calibrate.offload import prior_load

    load = prior_load(df).to_numpy()
    df["hour"] = df["t_hosp"].dt.hour
    df["offload_s"] = 2000 * np.exp(0.02 * (load - load.mean()) + rng.normal(0, 0.05, n))
    fit = fit_offload(df)
    assert abs(fit["beta"]["QUEENS"] - 0.02) < 0.004
    assert len(fit["base"]["QUEENS"]["10"]) == 101


def test_ratio_fit_recovers_a_known_slope():
    from ems.calibrate.offload import fit_offload_ratio, prior_load

    rng = np.random.default_rng(0)
    base = rng.uniform(0, 60 * 86400, 30000)
    surge = rng.uniform(30 * 86400, 37 * 86400, 6000)
    t = pd.Timestamp("2019-01-01") + pd.to_timedelta(np.sort(np.concatenate([base, surge])), unit="s")
    df = pd.DataFrame({"borough": "BRONX", "t_hosp": t, "transported": True})
    load = prior_load(df, window_s=86400).to_numpy()
    r = load / load[load > 0].mean()
    df["hour"] = df["t_hosp"].dt.hour
    df["offload_s"] = 2000 * np.exp(0.3 * (r - 1) + rng.normal(0, 0.05, len(df)))
    fit = fit_offload_ratio(df)
    assert fit["model"] == "ratio24" and fit["window_s"] == 86400
    assert abs(fit["beta"]["BRONX"] - 0.3) < 0.05
    assert len(fit["base"]["BRONX"]["10"]) == 101 and fit["mean_load"]["BRONX"] > 0


def test_fit_offload_base_has_no_load_term():
    from ems.calibrate.offload import fit_offload_base

    t = pd.to_datetime(["2019-01-01 10:00", "2019-01-01 10:30", "2019-01-01 11:00"])
    df = pd.DataFrame(
        {"borough": "BRONX", "t_hosp": t, "transported": True, "offload_s": [1000.0, 2000.0, 3000.0]}
    )
    fit = fit_offload_base(df)
    assert set(fit) == {"model", "base"}
    assert fit["model"] == "base"
    assert len(fit["base"]["BRONX"]["10"]) == 101


def test_jan2018_check_known_obs_and_pred():
    from ems.calibrate.offload import jan2018_check

    t = [pd.Timestamp("2017-12-08 12:00"), pd.Timestamp("2017-12-10 12:00"), pd.Timestamp("2017-12-12 12:00")]
    t += [pd.Timestamp("2018-01-05 12:00") + pd.Timedelta(minutes=k) for k in range(5)]
    df = pd.DataFrame(
        {"borough": "BRONX", "t_hosp": t, "transported": True, "offload_s": [1000.0] * 3 + [1100.0] * 5}
    )
    unk = pd.DataFrame(
        {
            "borough": ["UNKNOWN"],
            "t_hosp": [pd.Timestamp("2018-01-05 12:30")],
            "transported": [True],
            "offload_s": [99999.0],
        }
    )
    df = pd.concat([df, unk], ignore_index=True)
    df["day"] = df["t_hosp"].dt.date
    fit = {"window_s": 86400, "mean_load": {"BRONX": 10.0}, "beta": {"BRONX": 0.5}}
    got = jan2018_check(df, {"flu_2018": ["2018-01-05"]}, fit)
    assert set(got) == {"BRONX"}
    assert got["BRONX"]["obs"] == pytest.approx(1.1)
    assert got["BRONX"]["pred"] == pytest.approx(np.exp(0.1))
    assert got["BRONX"]["ok"] is True
