import importlib.util
import json
from datetime import date
from pathlib import Path

import numpy as np
import pytest

EMS = Path(__file__).resolve().parents[1]


def _load(rel: str, name: str):
    spec = importlib.util.spec_from_file_location(name, EMS / rel)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_red_generator_interface_returns_bounded_theta_from_the_date_only():
    from ems.scenarios.bounds import check

    gen = _load("experiments/ar/ems_red_sampler.py", "ems_red_gen_t")
    rng = np.random.default_rng(0)
    for d in (date(2016, 7, 4), date(2018, 1, 9)):
        assert check(gen.sample_theta(rng, d))
    assert len(gen.pick_days(rng, [date(2018, 1, 1), date(2018, 1, 2)], 5)) == 5


def test_red_bench_refuses_a_generator_that_picks_non_dev_days():
    bench = _load("experiments/ar/ems_red_bench.py", "ems_red_bench_t")

    class Bad:
        @staticmethod
        def pick_days(rng, days, n):
            return [date(2016, 6, 1)] * n

        @staticmethod
        def sample_theta(rng, d):
            return {}

    with pytest.raises(PermissionError):
        bench.pool(Bad, 3, 0)


def test_red_bench_refuses_out_of_bounds_theta(monkeypatch):
    bench = _load("experiments/ar/ems_red_bench.py", "ems_red_bench_t2")
    import ems.scenarios.core as core

    monkeypatch.setattr(core, "is_dev_day", lambda d: True)
    monkeypatch.setattr(core, "dev_days", lambda: [date(2018, 1, 1)])

    class Greedy:
        @staticmethod
        def pick_days(rng, days, n):
            return days[:1] * n

        @staticmethod
        def sample_theta(rng, d):
            return {"demand": 2.0}

    with pytest.raises(ValueError):
        bench.pool(Greedy, 2, 0)


def test_stress_pool_covers_2016_with_bounded_theta_and_pins_the_generator(tmp_path):
    sp = _load("scripts/stress_pool.py", "ems_stress_pool_t")
    gen = EMS / "experiments/ar/ems_red_sampler.py"
    pool = sp.build(str(gen))
    assert len(pool["days"]) == 366 and pool["days"][0]["date"] == "2016-01-01"
    from loopkit.ledger import file_sha256

    assert pool["generator_sha256"] == file_sha256(str(gen))
    assert pool == sp.build(str(gen))  # deterministic
    out = tmp_path / "pool.json"
    sp.main(["--generator", str(gen), "--out", str(out)])
    assert json.loads(out.read_text())["days"] == pool["days"]
