import numpy as np
import pytest


def test_bounds_reject_out_of_range_unknown_and_overload():
    from ems.scenarios.bounds import check

    assert check({"demand": 1.2, "unavailable": 0.1})
    for bad in ({"demand": 1.5}, {"surge": 1.0}, {"demand": 1.3, "unavailable": 0.2}):
        with pytest.raises(ValueError):
            check(bad)


def test_sampler_respects_load_cap_and_is_deterministic():
    from ems.scenarios.bounds import LOAD_CAP
    from ems.scenarios.sampler import sample_theta

    a = [sample_theta(np.random.default_rng(s)) for s in range(200)]
    b = [sample_theta(np.random.default_rng(s)) for s in range(200)]
    assert a == b
    assert all(t["demand"] / (1 - t["unavailable"]) <= LOAD_CAP for t in a)


def test_perturb_scales_demand_and_adds_concentration_calls():
    from ems.scenarios.core import perturb

    n = 2000
    rng = np.random.default_rng(0)
    day = {"t": np.sort(rng.uniform(0, 86400, n)), "z": rng.integers(0, 10, n).astype(np.int32),
           "b": np.zeros(n, np.int8), "tier": rng.choice([1, 2, 3], n).astype(np.int8),
           "g": np.zeros(n, np.int16), "held_obs": np.zeros(n, bool)}
    zip_b = np.zeros(10, np.int8)
    tg = {1: 0, 2: 1, 3: 2}
    up = perturb(day, {"demand": 1.3}, 1, zip_b, tg)
    assert 1.25 * n < len(up["t"]) < 1.35 * n and np.all(np.diff(up["t"]) >= 0)
    conc = perturb(day, {"concentration_calls": 50.0, "concentration_zips": 2.0}, 1, zip_b, tg)
    assert len(conc["t"]) == n + 50
    with pytest.raises(ValueError):
        perturb(day, {"demand": 2.0}, 1, zip_b, tg)


def test_evaluator_refuses_cached_days_outside_the_dev_set():
    from datetime import date

    from ems.evaluate import build_sim

    with pytest.raises(PermissionError):
        build_sim(date(2016, 6, 1), {}, 0, "b0")  # normal-2016 holdout
    with pytest.raises(PermissionError):
        build_sim(date(2019, 1, 5), {}, 0, "b0")  # a 2019 anchor day
