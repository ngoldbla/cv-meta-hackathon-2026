import numpy as np
import pandas as pd


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
