import numpy as np
import pytest

from cages.controllers import ESAPlanner
from cages.data import holdout_specs, make_specs
from cages.data.labeler import LabelConfig, rollout_costs
from cages.sim import Building, FiniteStream, Scenario, Simulation, waiting_cost


def _tiny():
    # all passengers arrive almost at once and cars carry two people, so later decisions are
    # re-registrations by stranded passengers -- there are no future arrivals to resample
    b = Building(n_floors=6, n_cars=2, rated_mass=160.0, car_area=0.5)
    s = FiniteStream("burst", 7, 0.0, 0.01, 1.0, 1.0, origins=((5, 1.0), (3, 1.0)), dests=((0, 1.0),),
                     class_mix=(("adult", 1.0),))
    return Scenario(building=b, streams=(s,), init_floors=(0, 2), t_max=2000.0, seed=11)


class Forced(ESAPlanner):
    def __init__(self, cid, action):
        super().__init__()
        self.cid, self.action = cid, action

    def assign(self, sim, call, exclude=()):
        return self.action if call.cid == self.cid else super().assign(sim, call, exclude)


def test_counterfactual_labels_match_brute_force_replay():
    sc = _tiny()
    probe = Simulation(sc, ESAPlanner()).run()
    late = [c for c in probe.call_log if c.t_register > 1.0]
    assert late, "expected re-registrations after the burst"
    target = late[0].cid
    captured = {}

    def hook(sim, call):
        if call.cid == target and not captured:
            captured["q"] = rollout_costs(sim, call, LabelConfig(K=1, horizon=1500.0))
            captured["t0"] = sim.now

    sim = Simulation(sc, ESAPlanner())
    sim.decision_hook = hook
    sim.run()
    q = captured["q"][0]
    t0 = captured["t0"]
    brute = []
    for a in range(2):
        s = Simulation(sc, Forced(target, a)).run()
        brute.append(waiting_cost(s, t0, t0 + 1500.0))
    assert np.allclose(q, brute, rtol=1e-9, atol=1e-6)
    assert int(np.argmin(q)) == int(np.argmin(brute))


def test_splits_are_deterministic_and_holdout_needs_salt(monkeypatch):
    assert make_specs("dev", 3) == make_specs("dev", 3)
    monkeypatch.delenv("CAGES_HOLDOUT_SALT", raising=False)
    with pytest.raises(PermissionError):
        holdout_specs(2)
    a = holdout_specs(2, salt="s1")
    b = holdout_specs(2, salt="s2")
    assert a != b and {x["id"] for x in a} == {"holdout-00000", "holdout-00001"}
