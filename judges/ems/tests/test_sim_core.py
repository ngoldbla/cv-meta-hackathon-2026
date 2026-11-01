import numpy as np
import pytest


def _cal(units_by_hour=None, p_transport=0.0):
    from ems.sim.calib import Calibration

    flat = lambda v: [float(v)] * 101  # noqa: E731
    svc = {"tier1-other": {"n": 10, "tier": 1, "processing_q": flat(30), "onscene_q": flat(600), "p_transport": p_transport,
                           "transport_q": flat(300), "nontransport_close_q": flat(900)},
           "tier2-other": {"n": 5, "tier": 2, "processing_q": flat(30), "onscene_q": flat(600), "p_transport": p_transport,
                           "transport_q": flat(300), "nontransport_close_q": flat(900)},
           "tier3-other": {"n": 5, "tier": 3, "processing_q": flat(30), "onscene_q": flat(600), "p_transport": p_transport,
                           "transport_q": flat(300), "nontransport_close_q": flat(900)}}
    hours = units_by_hour or {h: 1 for h in range(24)}
    fleet = {"BRONX": {str(h): {"median": float(n)} for h, n in hours.items()}}
    offload = {"model": "base", "base": {"BRONX": {str(h): flat(1200) for h in range(24)}, "BROOKLYN": {"0": flat(1200)}}}
    inputs = {"home_weights": {"BRONX": {"z0": 1.0}}, "fleet_k": 1.0,
              "travel": {"scale": {"BRONX": {str(h): 1.0 for h in range(24)}}, "sigma": {"BRONX": 0.0}}}
    return Calibration(svc, {}, offload, fleet, ["z0", "z1"], np.array([[0.0, 600.0], [600.0, 0.0]]), inputs)


def _day(rows):  # rows: (t, zip index, tier)
    return {"t": np.array([r[0] for r in rows], dtype=float), "z": np.array([r[1] for r in rows], dtype=np.int32),
            "b": np.zeros(len(rows), dtype=np.int8), "tier": np.array([r[2] for r in rows], dtype=np.int8),
            "g": np.array([r[2] - 1 for r in rows], dtype=np.int16), "held_obs": np.zeros(len(rows), dtype=bool)}


def test_single_call_response_is_processing_plus_travel_and_within_zip_is_half_nearest():
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    cal = _cal()
    assert cal.durations[0, 0] == 300.0
    r = Simulation(cal, _day([(100.0, 1, 1)]), Practice()).run().records()
    assert r["t_scene"][0] == 100.0 + 30.0 + 600.0 and not r["held"][0]


def test_held_and_tier_priority_with_one_unit():
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    r = Simulation(_cal(), _day([(100.0, 0, 3), (200.0, 0, 3), (210.0, 0, 1)]), Practice()).run().records()
    assert not r["held"][0] and r["held"][1] and r["held"][2]
    assert r["t_assign"][2] < r["t_assign"][1]  # tier 1 is served before the earlier tier-3 call


def test_clone_continues_exactly_like_the_original():
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    day = _day([(t, t % 2, 1 + t % 3) for t in range(0, 20000, 700)])
    a = Simulation(_cal({h: 2 for h in range(24)}, p_transport=0.5), day, Practice(), seed=3)
    a.run(until=6000.0)
    b = a.clone()
    ra, rb = a.run().records(), b.run().records()
    for k in ra:
        assert np.array_equal(ra[k], rb[k], equal_nan=True), k


def test_activate_respects_the_unit_hour_budget():
    from ems.policy.api import Activate
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    sim = Simulation(_cal(), _day([(100.0, 0, 1)]), Practice())
    assert sim.budget == pytest.approx(0.10 * 24)
    sim._apply([Activate(0, 1)])
    assert sim.invalid == 1  # one 12-hour unit costs 12 unit-hours > 2.4


def test_divert_sends_a_callback_as_tier_2():
    from ems.policy.api import Divert
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    class DivertAll(Practice):
        def act(self, obs):
            return [Divert(c.i) for c in obs.queue if c.tier == 3]

    r = Simulation(_cal(), _day([(100.0, 0, 3)]), DivertAll(), params={"divert_callback_p": 1.0}).run().records()
    assert r["diverted"][0] and len(r["tier"]) == 2 and r["tier"][1] == 2 and r["parent"][1] == 0


def test_shifts_follow_the_fleet_target():
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    sim = Simulation(_cal({h: (2 if h < 12 else 1) for h in range(24)}), _day([(50000.0, 0, 1)]), Practice())
    sim.run(until=13 * 3600.0)
    assert sum(u.on_duty for u in sim.units) == 1 and len(sim.units) == 2


def test_practice_sends_the_closest_idle_unit():
    from ems.policy.practice import Practice
    from ems.sim.core import Simulation

    cal = _cal({h: 2 for h in range(24)})
    cal.sim_inputs["home_weights"] = {"BRONX": {"z0": 0.5, "z1": 0.5}}
    r = Simulation(cal, _day([(100.0, 1, 1)]), Practice()).run().records()
    assert r["t_scene"][0] == 100.0 + 30.0 + 300.0  # the unit already in z1 (within-zip travel 300 s)
