from pathlib import Path

import yaml

from cages.controllers import Timetable
from cages.data.instances import CITI_FIELD_CAPACITY, make_specs
from cages.data.stock import load_line_stock
from cages.sim import Simulation, evacuation_scenario, evaluate, line_from_stock

ANCHORS = {p.stem: yaml.safe_load(p.read_text()) for p in (Path(__file__).parents[1] / "anchors").glob("*.yaml")}
STOCK = load_line_stock()


def test_every_anchor_names_its_enforcing_test():
    for name, card in ANCHORS.items():
        assert {"id", "value", "source", "enforced_by", "status"} <= set(card), name


def test_train_capacity_from_r188():
    v = ANCHORS["r188_train"]["value"]
    line = line_from_stock(STOCK)
    n_bc = v["cars_per_train"] - v["a_cars_per_train"]
    assert line.train_capacity == v["a_cars_per_train"] * v["a_car_capacity"] + n_bc * v["bc_car_capacity"]
    assert line.n_cars == v["cars_per_train"] and line.doors == v["cars_per_train"] * v["doors_per_side_per_car"]


def test_boarding_not_faster_than_bottleneck_flow():
    flow = ANCHORS["bottleneck_specific_flow"]["value"]["specific_flow_pms"]
    line = line_from_stock(STOCK)
    assert line.t_board >= 1.0 / (flow * 1.27) and line.t_alight >= 1.0 / (flow * 1.27)


def test_event_station_entry_rate_covers_observed_peak():
    peak = ANCHORS["mets_willets_point_entries"]["value"]["max_hourly_entries"]
    assert max(p["entries"] for p in STOCK["event_station_peak_hours"]) == peak
    for s in make_specs("dev", 50) + make_specs("train", 50):
        assert s["entry_rate_event"] >= peak / 3600.0


def test_instances_respect_venue_capacity_and_egress_time():
    v = ANCHORS["venue_and_station"]["value"]
    assert CITI_FIELD_CAPACITY == v["citi_field_capacity"]
    for s in make_specs("dev", 50) + make_specs("train", 50):
        assert s["occupancy"] <= v["citi_field_capacity"] and s["window"] >= 60 * v["green_guide_egress_min"]


def test_bus_capacity():
    assert line_from_stock(STOCK).bus_capacity == ANCHORS["bus"]["value"]["total"]


def test_nfpa_reference_metric_is_reported():
    sc = evacuation_scenario(STOCK, occupancy=20000, seed=3)
    m = evaluate(Simulation(sc, Timetable()).run())
    assert 0.0 <= m["platform_over_4min_frac"] <= 1.0
    assert ANCHORS["nfpa130_egress"]["value"]["platform_clear_min"] == 4
