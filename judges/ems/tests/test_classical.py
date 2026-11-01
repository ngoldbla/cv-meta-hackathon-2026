import importlib.util
from pathlib import Path

import numpy as np

_spec = importlib.util.spec_from_file_location("ems_toy_sim", Path(__file__).with_name("test_sim_core.py"))
_toy = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_toy)
_cal, _day = _toy._cal, _toy._day


def test_b1_activates_when_queue_reaches_threshold_and_respects_budget():
    from ems.policy.api import Activate
    from ems.policy.classical import Classical
    from ems.sim.core import Simulation

    cal = _cal()
    cal.sim_inputs["hourly_calls"] = {"BRONX": {str(h): 1.0 for h in range(24)}}
    pol = Classical({"activate_queue": 2, "activate_n": 1, "divert_queue": 99})
    seen = []
    act = pol.act
    pol.act = lambda obs: seen.extend(a for a in act(obs) if isinstance(a, Activate)) or act(obs)
    sim = Simulation(cal, _day([(100.0, 1, 3), (101.0, 1, 3), (102.0, 1, 3)]), pol).run()
    assert seen and sim.unit_hours_extra <= sim.budget


def test_b1_diverts_only_within_quota():
    from ems.policy.classical import Classical
    from ems.sim.core import Simulation

    cal = _cal()
    cal.sim_inputs["hourly_calls"] = {"BRONX": {str(h): 1.0 for h in range(24)}}
    rows = [(100.0 + i, 1, 3) for i in range(10)]
    sim = Simulation(cal, _day(rows), Classical({"activate_queue": 99, "divert_queue": 2}), params={"divert_cap": 0.43})
    sim.run()
    rec = sim.records()
    assert 0 < rec["diverted"].sum() <= np.ceil(0.43 * 10) and sim.invalid == 0
