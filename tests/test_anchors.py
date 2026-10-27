from pathlib import Path

import yaml

from cages.data.instances import car_area_for, load_stock, make_specs
from cages.sim import FailureModes, Kinematics, venue_building

ANCHORS = {p.stem: yaml.safe_load(p.read_text()) for p in (Path(__file__).parents[1] / "anchors").glob("*.yaml")}


def test_every_anchor_names_its_enforcing_test():
    for name, card in ANCHORS.items():
        assert {"id", "value", "source", "enforced_by", "status"} <= set(card), name


def test_boarding_not_faster_than_bottleneck_flow():
    flow = ANCHORS["bottleneck_specific_flow"]["value"]["specific_flow_pms"]
    k = Kinematics()
    assert k.t_board >= 1.0 / (flow * 1.1) and k.t_alight >= 1.0 / (flow * 1.1)


def test_lobby_exit_flow_within_observed_range():
    vmax = ANCHORS["stadium_egress_flow"]["value"]["green_guide_max_pmmin"] / 60.0
    width = 4.0
    for s in (0.0, 0.5, 1.0):
        b = venue_building().with_failures(FailureModes(w9_lobby=s))
        assert b.exit_rate / width <= vmax


def test_car_area_table():
    table = ANCHORS["en81_car_area"]["value"]["rated_kg_to_area_m2"]
    for kg, area in table:
        assert abs(car_area_for(kg) - area) < 1e-9


def test_instances_drawn_from_registry():
    stock = load_stock()
    speeds = {round(r["speed_ms"], 6) for r in stock}
    for s in make_specs("dev", 10):
        assert any(abs(s["speed_ms"] - v) < 1e-6 for v in speeds) or s["speed_ms"] in (1.5, 6.0)


def test_kinematics_defaults_in_design_ranges():
    v = ANCHORS["transfer_and_door_times"]["value"]
    k = Kinematics()
    assert v["transfer_s"][0] <= k.t_board <= v["transfer_s"][1]
    assert v["door_open_s"][0] <= k.t_door_open <= v["door_open_s"][1]
    assert v["door_close_s"][0] <= k.t_door_close <= v["door_close_s"][1]
