import importlib.util
import io
from pathlib import Path

import numpy as np
import pytest

EMS = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("ems_toy_sim_l", Path(__file__).with_name("test_sim_core.py"))
_toy = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_toy)
_cal, _day = _toy._cal, _toy._day


def _load(rel: str, name: str):
    spec = importlib.util.spec_from_file_location(name, EMS / rel)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _toy_cal():
    cal = _cal(units_by_hour={h: 2 for h in range(24)})
    cal.sim_inputs["hourly_calls"] = {"BRONX": {str(h): 1.0 for h in range(24)}}
    return cal


def _rows():
    return [(100.0 + 37 * i, i % 2, 1 + i % 3) for i in range(30)]


def test_unweighted_learned_policy_is_exactly_b1():
    from ems.policy.classical import Classical
    from ems.sim.core import Simulation
    from emslearn.policy import LearnedPolicy

    a = Simulation(_toy_cal(), _day(_rows()), Classical(), seed=3).run().records()
    b = Simulation(_toy_cal(), _day(_rows()), LearnedPolicy(), seed=3).run().records()
    for k in ("t_scene", "t_assign", "held", "diverted"):
        assert np.array_equal(np.nan_to_num(a[k], nan=-1), np.nan_to_num(b[k], nan=-1)), k


def test_hold_leaves_the_call_alone_for_hold_s():
    from ems.sim.core import Simulation
    from emslearn.policy import HOLD_S, LearnedPolicy

    class HoldOnce(LearnedPolicy):
        held = False

        def score(self, x):
            if not self.held:
                self.held = True
                return x[:, 11] * 10.0 - 1.0  # prefers hold, once
            return super().score(x)

    rec = Simulation(_toy_cal(), _day([(100.0, 1, 3)]), HoldOnce(), seed=0).run().records()
    ready = 100.0 + 30.0  # processing time in the toy calibration
    assert ready + HOLD_S <= rec["t_assign"][0] < ready + HOLD_S + 3600


def test_recording_keeps_one_record_per_scored_decision():
    from ems.sim.core import Simulation
    from emslearn.policy import FEATURES, K, LearnedPolicy

    pol = LearnedPolicy()
    pol.recording = True
    Simulation(_toy_cal(), _day(_rows()), pol, seed=1).run()
    assert pol.decisions and all(d["x"].shape[1] == len(FEATURES) and d["x"].shape[0] <= K + 1 for d in pol.decisions)
    assert all(d["x"][-1, 11] == 1.0 for d in pol.decisions)  # hold is always the last option


def test_mlp_weights_load_and_score():
    from emslearn.policy import load_mlp, mlp

    rng = np.random.default_rng(0)
    w = {"w0": rng.normal(size=(12, 8)), "b0": rng.normal(size=8), "w1": rng.normal(size=(8, 1)), "b1": rng.normal(size=1)}
    buf = io.BytesIO()
    np.savez(buf, **w)
    p = Path(_toy.__file__).parent / "_tmp_w.npz"
    try:
        p.write_bytes(buf.getvalue())
        layers = load_mlp(p)
    finally:
        p.unlink()
    x = rng.normal(size=(5, 12))
    ref = (np.maximum(x @ w["w0"] + w["b0"], 0) @ w["w1"] + w["b1"])[:, 0]
    assert np.allclose(mlp(layers, x), ref)


def test_es_linear_start_scores_like_b1_and_roundtrips():
    es = _load("experiments/ar/ems_es.py", "ems_es_t")
    from emslearn.policy import LearnedPolicy

    ws = es.b1_linear()
    v, spec = es.flat(ws)
    back = dict(np.load(io.BytesIO(es.unflat(v, spec))))
    assert all(np.allclose(back[k], ws[k]) for k in ws)
    x = np.random.default_rng(1).uniform(0, 2, size=(17, 12))
    x[:, 11] = 0
    x[-1, 11] = 1
    pol = LearnedPolicy()
    lin = (x @ ws["w0"] + ws["b0"])[:, 0]
    assert np.argmax(lin) == np.argmax(pol.score(x))


def test_remote_refuses_jobs_over_the_program_budget(monkeypatch):
    from emslearn import remote

    class B:
        PROGRAM_BUDGET_USD = 10.0

        @staticmethod
        def spent():
            return 9.5

    monkeypatch.setattr(remote, "_budget", lambda: B)
    with pytest.raises(RuntimeError, match="refused"):
        remote._guard("x", 1.0)


def test_cli_pool_mixes_nominal_and_generator_days(monkeypatch):
    from datetime import date

    import ems.scenarios.core as core
    import ems.scenarios.sampler as sampler
    from emslearn import cli

    days = [date(2018, 1, 1) + __import__("datetime").timedelta(days=i) for i in range(30)]
    monkeypatch.setattr(core, "dev_days", lambda: days)
    monkeypatch.setattr(core, "is_dev_day", lambda d: d in days)
    monkeypatch.setattr(sampler, "dev_days", lambda: days)
    p = cli.pool(5, 0, str(EMS / "experiments/ar/ems_red_sampler.py"), 3)
    assert len(p) == 8 and all(d in days for d, _, _ in p)


def test_train_script_exports_weights_the_policy_can_load(tmp_path):
    torch = pytest.importorskip("torch")
    tr = _load("experiments/ar/ems_train.py", "ems_train_t")
    from emslearn.policy import load_mlp

    net = tr.model(12, [16])
    out = tmp_path / "w.npz"
    tr.export(net, str(out))
    layers = load_mlp(out)
    x = np.random.default_rng(0).normal(size=(4, 12)).astype(np.float32)
    with torch.no_grad():
        ref = net(torch.from_numpy(x))[:, 0].numpy()
    from emslearn.policy import mlp

    assert np.allclose(mlp(layers, x), ref, atol=1e-5)


def test_merge_shards_union_window_and_errors(tmp_path):
    from emslearn.shards import MAX_DIRS, merge

    for d in ("data/full/it05", "data/full/it06"):
        p = tmp_path / d
        p.mkdir(parents=True)
        for i in range(3):
            np.savez(p / f"{i:05d}.npz", x=np.array([i]))
    into = tmp_path / "merged"
    assert merge(tmp_path, ["data/full/it05", "data/full/it06"], into) == 6
    names = sorted(f.name for f in into.glob("*.npz"))
    assert names[0] == "data_full_it05-00000.npz" and len(names) == 6
    assert np.load(into / "data_full_it06-00002.npz")["x"][0] == 2
    with pytest.raises(ValueError):
        merge(tmp_path, [f"d{i}" for i in range(MAX_DIRS + 1)], tmp_path / "m2")
    with pytest.raises(FileNotFoundError):
        merge(tmp_path, ["data/full/missing"], tmp_path / "m3")


def test_drop_hold_labels_masks_hold_and_hold_choices(tmp_path):
    from emslearn.policy import FEATURES
    from emslearn.shards import drop_hold_labels, merge

    h = FEATURES.index("is_hold")
    X = np.zeros((3, 4, len(FEATURES)), np.float32)
    X[:, 2, h] = 1.0  # option 2 is hold, option 3 is padding
    delta = np.array([[0.0, -5.0, -9.0, np.nan],  # chose unit 0: hold label dropped, unit label kept
                      [3.0, 0.0, 1.0, np.nan],  # chose unit 1
                      [4.0, 2.0, 0.0, np.nan]], np.float32)  # chose hold: whole label dropped
    shard = {"X": X, "delta": delta, "choice": np.array([0, 1, 2], np.int16), "mask": X[:, :, 0] == 0}
    out = drop_hold_labels(shard)
    assert np.isnan(out["delta"][:, 2]).all() and np.isnan(out["delta"][2]).all()
    assert out["delta"][0, 1] == -5.0 and out["delta"][1, 0] == 3.0
    assert np.array_equal(out["X"], X) and not np.isnan(shard["delta"][0, 2])  # input left as it was
    d = tmp_path / "data/full/it06"
    d.mkdir(parents=True)
    np.savez(d / "00000.npz", **shard)
    assert merge(tmp_path, ["data/full/it06"], tmp_path / "m", transform=drop_hold_labels) == 1
    got = np.load(tmp_path / "m" / "data_full_it06-00000.npz")
    assert not (tmp_path / "m" / "data_full_it06-00000.npz").is_symlink() and np.isnan(got["delta"][0, 2])
