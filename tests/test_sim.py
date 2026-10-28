import numpy as np
import pytest

from cages.controllers import ExpressRule, ForecastStaging, NextTrain, RollingHorizon, Timetable
from cages.data.stock import load_line_stock
from cages.sim import (
    DOWN,
    UP,
    BackgroundStream,
    EvacStream,
    FailureModes,
    Scenario,
    Simulation,
    evacuation_scenario,
    evaluate,
    line_from_stock,
)

STOCK = load_line_stock()


def _scenario(fm=None, seed=1, occupancy=30000, **kw):
    return evacuation_scenario(STOCK, occupancy=occupancy, subway_share=0.45, hour=21, failures=fm or FailureModes(),
                               seed=seed, **kw)


def test_stock_is_the_7_line():
    names = [s["name"] for s in STOCK["stations"]]
    assert len(names) == 22 and names[0] == "Flushing-Main St" and names[-1] == "34 St-Hudson Yards"
    assert names[1] == "Mets-Willets Point"
    assert all(b > a for a, b in zip([s["pos_m"] for s in STOCK["stations"]],
                                      [s["pos_m"] for s in STOCK["stations"]][1:], strict=False))


def test_empty_line_reproduces_gtfs_run_times():
    """One train on an empty line stops at every station on the GTFS schedule (where kinematically feasible)."""
    line = line_from_stock(STOCK, n_service=1, n_yard=0, n_buses=0, headway=60.0)
    sc = Scenario(line, streams=(), t_onset=10_000.0, t_max=10_000.0, seed=0)
    sim = Simulation(sc, Timetable(), record_trace=True)
    sim.run(until=6000.0)
    stops = [(e["t"], e["station"], e["dir"]) for e in sim.trace if e["ev"] == "stop"]
    up = [(t, s) for t, s, d in stops if d == UP]
    run = {s: t2 - t1 for (t1, s), (t2, s2) in zip(up, up[1:], strict=False) if s2 == s + 1}
    assert len(run) >= 15
    for s, dt in run.items():
        gtfs = STOCK["segment_s"][s]
        floor = line.seg_time(s, UP, True, True) + line.t_min_dwell  # kinematic floor where GTFS is too tight
        assert dt == pytest.approx(max(gtfs, floor), abs=1.0)
    total_sim = sum(run.values())
    total_gtfs = sum(STOCK["segment_s"][s] for s in run)
    assert total_sim == pytest.approx(total_gtfs, rel=0.03)


class FourthTrain(NextTrain):
    def assign(self, sim, call):
        return 4 if call.slots[4] is not None else super().assign(sim, call)


def test_one_train_per_block_and_no_overtaking():
    sc = _scenario(occupancy=40000)
    sim = Simulation(sc, FourthTrain())
    taken = []
    orig = sim._take

    def checked(res, ti):
        table = sim.plat_occ if res[0] == "plat" else sim.seg_occ
        assert table.get(res[1:]) in (None, ti), f"{res} held by {table.get(res[1:])}, wanted by {ti}"
        taken.append(res)
        orig(res, ti)

    sim._take = checked
    sim.run()
    assert len(taken) > 1000 and not sim.deadlocked
    assert sum(t.n_skips for t in sim.trains) > 0  # express runs happened and still respected the blocks


def test_dwell_grows_with_boarding_load():
    line = line_from_stock(STOCK, n_service=1, n_yard=0, n_buses=0)
    sc = Scenario(line, streams=(), t_onset=10_000.0, t_max=10_000.0, seed=0)
    dwells = []
    for n in (0, 600):
        sim = Simulation(sc, Timetable())
        t = sim.trains[0]
        s, d = t.station, t.direction
        for _ in range(n):
            sim._place_on_platform(sim._new_passenger(s, s + d if 0 <= s + d < 22 else s - d, "bg"))
        sim._heap.clear()
        sim._serve(t, s)
        close = [e for e in sim._heap if e[2] == "close"]
        dwells.append(close[0][0] - sim.now)
    assert dwells[0] == pytest.approx(line.t_min_dwell)
    assert dwells[1] == pytest.approx(line.t_doors + 600 * line.t_board / line.doors)  # 33 doors share the crowd


@pytest.mark.parametrize("mode", ["w1_hidden", "w2_left_behind", "w4_doors", "w6_cold", "w9_egress"])
def test_each_failure_mode_has_its_effect(mode):
    nominal = Simulation(_scenario(), ExpressRule()).run()
    severe = Simulation(_scenario(FailureModes(**{mode: 1.0})), ExpressRule()).run()
    a, b = evaluate(nominal), evaluate(severe)
    if mode == "w1_hidden":
        first = lambda s: min((c.t_register for c in s.call_log if c.station == s.L.event_station), default=1e9)  # noqa: E731
        assert first(severe) > first(nominal) + 100
    elif mode == "w2_left_behind":
        assert b["stranded_frac"] > a["stranded_frac"] and b["p95"] > a["p95"]
    elif mode == "w4_doors":
        assert b["p95"] > a["p95"]
    elif mode == "w6_cold":
        assert severe.L.n_service < nominal.L.n_service and b["p95"] > a["p95"]
    elif mode == "w9_egress":
        assert b["peak_plaza_density"] > a["peak_plaza_density"]


def test_every_passenger_boards_once_and_nobody_is_lost():
    sim = Simulation(_scenario(occupancy=20000), ForecastStaging(RollingHorizon())).run()
    m = evaluate(sim)
    pids = [b.pid for b in sim.done]
    assert len(pids) == len(set(pids))
    assert m["n_censored"] == 0 and m["n_passengers"] == len(sim.done)
    assert m["bus_boarded"] > 0 and all(t.load >= -1e-9 for t in sim.trains)
    assert all(t.load <= sim.L.train_capacity + 1e-6 for t in sim.trains)


def test_clone_reproduces_the_run_exactly():
    """A clone taken at a decision, given the same decision, replays the original run event for event."""
    sc = _scenario(occupancy=25000, seed=5)
    clones = []

    def hook(sim, call):
        if not clones and sim.now > sim.t_onset:
            c = sim.clone()
            cc = c.active_calls[(call.station, call.direction)]
            c.assign(cc, c.controller.assign(c, cc))
            clones.append(c)

    sim = Simulation(sc, RollingHorizon())
    sim.decision_hook = hook
    sim.run()
    c = clones[0]
    t0 = c.now
    c.run()
    after = lambda s: sorted((b.pid, round(b.t_board, 9), b.vehicle) for b in s.done if b.t_board > t0)  # noqa: E731
    assert after(c) == after(sim) and len(after(c)) > 1000
    assert c.t_end == pytest.approx(sim.t_end)


def test_conditional_resampling_keeps_the_crowd_size():
    sc = _scenario(occupancy=20000, seed=2)
    sim = Simulation(sc, Timetable())
    sim.run(until=sc.t_onset + 600.0)
    c = sim.clone(drop_future=True)
    c.resample_future(3)
    n_evac = next(s for s in sc.streams if isinstance(s, EvacStream)).n
    future = sum(1 for p in c.pax.values() if p.stream == "evac" and p.t_arrive > c.now)
    assert c.arrived_by_stream.get("evac", 0) + future == n_evac


def test_background_stream_is_memoryless_and_rate_matches():
    st = BackgroundStream(rates=(0.5, 0.0, 0.25), attract=(1.0, 1.0, 1.0), t0=0.0, t1=4000.0)
    out = st.sample(np.random.default_rng(0))
    counts = np.bincount(out["o"], minlength=3)
    assert counts[1] == 0 and counts[0] == pytest.approx(2000, rel=0.1) and counts[2] == pytest.approx(1000, rel=0.1)
    assert np.all(out["o"] != out["d"])


def test_operator_logs_understate_evacuation_waits():
    m = evaluate(Simulation(_scenario(occupancy=40000), Timetable()).run())
    assert m["stranded_frac"] > 0.2 and m["logged_stranded_frac"] == 0.0
    assert m["logger_understatement"] > 0.25


def test_yard_trains_and_staging_add_capacity():
    sc = _scenario(occupancy=40000)
    base = evaluate(Simulation(sc, Timetable()).run())
    staged = evaluate(Simulation(sc, ForecastStaging(Timetable())).run())
    assert staged["evac_p95"] < base["evac_p95"]


def test_directions_and_terminals():
    line = line_from_stock(STOCK)
    assert line.terminal(UP) == 21 and line.terminal(DOWN) == 0
    assert line.hub(UP) == 7 and line.hub(DOWN) == 0
