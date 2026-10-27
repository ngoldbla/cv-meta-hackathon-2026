import itertools
import math

import numpy as np
import pytest

from cages.controllers import ClosestCar, ESAPlanner, kmedian_line, weighted_median
from cages.sim import FailureModes, Kinematics, Simulation, evaluate, uppeak_scenario, venue_scenario


def test_kinematics_position_matches_flight_time():
    kin = Kinematics(speed=3.5, accel=1.0)
    for floors in (1, 2, 5, 20):
        T = kin.flight_time(floors)
        assert kin.position(floors, T) == pytest.approx(floors)
        xs = [kin.position(floors, t) for t in np.linspace(0, T, 50)]
        assert all(b >= a - 1e-9 for a, b in zip(xs, xs[1:]))  # monotone


def test_round_trip_time_matches_barney():
    """Simulated up-peak round trip time equals Barney's RTT = 2H tv + (S+1) ts + 2P tp."""
    N, P = 12, 8
    kin = Kinematics(speed=1.6, accel=1.0, t_door_open=1.8, t_door_close=2.9, t_board=1.0, t_alight=1.0, t_dwell_min=0.0)
    assert kin.floor_height >= kin.accel_distance  # every leg reaches rated speed
    sim = Simulation(uppeak_scenario(N, P, n_pax=4000, seed=3, kin=kin), ClosestCar()).run()
    opens = [t for (_, f, t, *_rest) in sim.door_log if f == 0]
    rtt_sim = float(np.mean(np.diff(opens)[5:-5]))
    S = N * (1 - (1 - 1 / N) ** P)
    H = N - sum((i / N) ** P for i in range(1, N))
    tv = kin.floor_height / kin.speed
    ts = kin.speed / kin.accel + kin.t_door_open + kin.t_door_close
    rtt = 2 * H * tv + (S + 1) * ts + P * (kin.t_board + kin.t_alight)
    assert rtt_sim == pytest.approx(rtt, rel=0.02)


def _small(kind="egress", fm=None, seed=0, attendees=300):
    return venue_scenario(kind, attendees, fm or FailureModes(), seed=seed)


def test_conservation_and_capacity():
    sim = Simulation(_small(fm=FailureModes(0.5, 0.5, 0.5, 0.5, 0.5)), ESAPlanner()).run()
    assert sim.finished() and not sim.deadlocked
    pids = [p.pid for p in sim.done]
    assert len(pids) == len(set(pids)) == sim._next_pid
    for p in sim.done:
        assert p.t_arrive <= p.t_board <= p.t_alight
    for _, _, _, _, _, _, load in sim.door_log:
        assert load <= sim.b.rated_mass + 1e-6


def test_determinism_and_clone_fidelity():
    sc = _small(fm=FailureModes(0.3, 0.7, 0.7, 0.3, 0.3), seed=5)
    a = evaluate(Simulation(sc, ESAPlanner()).run())
    b = evaluate(Simulation(sc, ESAPlanner()).run())
    assert a == b
    s = Simulation(sc, ESAPlanner()).run(until=600.0)
    n_before = len(s.done)
    c = s.clone()
    s.run()
    c.run()
    ws = sorted((p.pid, p.t_board, p.t_alight) for p in s.done[n_before:])
    wc = sorted((p.pid, p.t_board, p.t_alight) for p in c.done)
    assert ws == wc and len(wc) > 0


def _metric(fm, key, kind="egress", seeds=(0, 1, 2), attendees=400):
    vals = []
    for sd in seeds:
        vals.append(evaluate(Simulation(_small(kind, fm, sd, attendees), ClosestCar()).run())[key])
    return float(np.mean(vals))


def test_w1_hidden_queue_raises_tail_wait():
    assert _metric(FailureModes(w1_hidden_queue=1.0), "p95") > _metric(FailureModes(), "p95")


def test_w2_strand_raises_waits():
    assert _metric(FailureModes(w2_strand=1.0), "awt") > _metric(FailureModes(), "awt")


def test_w4_held_doors_lengthen_dwell():
    def dwell(fm):
        sim = Simulation(_small(fm=fm, attendees=800), ClosestCar()).run()
        return float(np.mean([tc - to for (_, _, to, tc, *_r) in sim.door_log]))

    assert dwell(FailureModes(w4_doors=1.0)) > dwell(FailureModes()) + 0.5


def test_w6_cold_start_delays_first_pickup():
    def first_pickup(fm):
        sim = Simulation(_small(fm=fm, attendees=400), ClosestCar()).run()
        surge = [p for p in sim.done if p.stream == "egress"]
        return min(p.t_board for p in surge) - min(p.t_arrive for p in surge)

    assert first_pickup(FailureModes(w6_cold=1.0)) > first_pickup(FailureModes())


def test_w9_saturated_lobby_raises_lobby_density():
    fm = FailureModes(w9_lobby=1.0)
    assert _metric(fm, "peak_lobby_density", "ingress") > _metric(FailureModes(), "peak_lobby_density", "ingress")


def test_logger_understates_crush_waits():
    m = evaluate(Simulation(_small(attendees=800), ClosestCar()).run())
    assert m["logger_awt"] < 0.5 * m["awt"]


def test_weighted_median_is_eq6_argmin():
    rng = np.random.default_rng(0)
    for _ in range(50):
        w = rng.random(12) * (rng.random(12) > 0.3)
        if w.sum() == 0:
            continue
        cost = [sum(abs(x - f) * w[x] for x in range(12)) for f in range(12)]
        assert cost[weighted_median(w)] == pytest.approx(min(cost))


def test_kmedian_matches_brute_force():
    rng = np.random.default_rng(1)
    for _ in range(20):
        w = rng.random(9)
        for k in (1, 2, 3):
            best = min(
                sum(w[x] * min(abs(x - m) for m in ms) for x in range(9)) for ms in itertools.combinations(range(9), k)
            )
            got = kmedian_line(w, k)
            val = sum(w[x] * min(abs(x - m) for m in got) for x in range(9))
            assert val == pytest.approx(best, rel=1e-9, abs=1e-9)


def test_paper_profile_runs():
    from dataclasses import replace

    from cages.sim import PAPER_PROFILE, venue_building

    b = replace(venue_building(n_floors=10, n_cars=2, wait_area_overrides=()), kin=PAPER_PROFILE)
    sc = venue_scenario("egress", 100, building=b, event_floor=8)
    m = evaluate(Simulation(sc, ClosestCar()).run())
    assert m["n_censored"] == 0 and math.isfinite(m["awt"])
