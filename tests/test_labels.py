import numpy as np
import pytest

from cages.controllers import RollingHorizon
from cages.data import holdout_specs, make_specs
from cages.data.labeler import LabelConfig, rollout_costs
from cages.data.stock import load_line_stock
from cages.sim import EvacStream, Scenario, Simulation, line_from_stock, waiting_cost


def _burst():
    # the whole crowd reaches the station within one second, so every alert comes after the last
    # arrival: there are no future passengers to resample and a brute-force replay is exact
    stock = load_line_stock()
    line = line_from_stock(stock, n_service=8, n_yard=3, n_buses=2, headway=480.0)
    ev = line.event_station
    dest = np.zeros(line.n_stations)
    dest[[7, 21]] = 0.5
    dest[0] = 0.0
    crowd = EvacStream(3000, 310.0, 311.0, 1.0, 1.0, ev, tuple(dest / dest.sum()))
    return Scenario(line, (crowd,), t_onset=300.0, t_max=4000.0, seed=11)


class Forced(RollingHorizon):
    def __init__(self, cid, slot):
        super().__init__()
        self.cid, self.slot = cid, slot

    def assign(self, sim, call):
        return self.slot if call.cid == self.cid else super().assign(sim, call)


def test_counterfactual_labels_match_brute_force_replay():
    sc = _burst()
    probe = Simulation(sc, RollingHorizon()).run()
    assert probe.call_log, "expected platform-crowding alerts"
    target = probe.call_log[0].cid
    captured = {}

    def hook(sim, call):
        if call.cid == target and not captured:
            captured["q"] = rollout_costs(sim, call, LabelConfig(K=1, horizon=1500.0))
            captured["t0"] = sim.now
            captured["valid"] = [j for j, c in enumerate(call.slots) if c is not None]

    sim = Simulation(sc, RollingHorizon())
    sim.decision_hook = hook
    sim.run()
    q, t0, valid = captured["q"][0], captured["t0"], captured["valid"]
    assert len(valid) >= 4 and np.isnan(q[[j for j in range(8) if j not in valid]]).all()
    brute = {}
    for a in valid:
        s = Simulation(sc, Forced(target, a)).run()
        brute[a] = waiting_cost(s, t0, t0 + 1500.0)
    assert np.allclose([q[a] for a in valid], [brute[a] for a in valid], rtol=1e-9, atol=1e-6)
    assert len({round(v, 3) for v in brute.values()}) > 1  # the choice matters


def test_splits_are_deterministic_and_holdout_needs_salt(monkeypatch):
    assert make_specs("dev", 3) == make_specs("dev", 3)
    monkeypatch.delenv("CAGES_HOLDOUT_SALT", raising=False)
    with pytest.raises(PermissionError):
        holdout_specs(2)
    a = holdout_specs(2, salt="s1")
    b = holdout_specs(2, salt="s2")
    assert a != b and {x["id"] for x in a} == {"holdout-00000", "holdout-00001"}
