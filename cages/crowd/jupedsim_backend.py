"""Optional JuPedSim backend (LGPL-3.0, imported only -- never vendored).

Provides the same corridor speed measurement as ``social_force.corridor_speed`` using JuPedSim's
Collision Free Speed Model, so the two crowd models can be cross-checked against Weidmann.
Install with ``pip install cages[jupedsim]``.  Written against the jupedsim 1.x Python API;
untested in environments where jupedsim is unavailable.
"""

from __future__ import annotations

import numpy as np


def available() -> bool:
    try:
        import jupedsim  # noqa: F401
        import shapely  # noqa: F401
    except Exception:
        return False
    return True


def corridor_speed(rho: float, length: float = 60.0, width: float = 4.0, measure=(20.0, 40.0),
                   t_sim: float = 20.0, dt: float = 0.01, seed: int = 0) -> float:
    """Mean speed of agents inside the measurement section of a straight corridor."""
    import jupedsim as jps
    from shapely import Polygon

    rng = np.random.default_rng(seed)
    geometry = Polygon([(0, 0), (length + 5, 0), (length + 5, width), (0, width)])
    sim = jps.Simulation(model=jps.CollisionFreeSpeedModel(), geometry=geometry, dt=dt)
    exit_id = sim.add_exit_stage(Polygon([(length, 0), (length + 5, 0), (length + 5, width), (length, width)]))
    journey = sim.add_journey(jps.JourneyDescription([exit_id]))
    n = max(2, int(round(rho * length * width)))
    nx = int(np.ceil(np.sqrt(n * length / width)))
    ny = int(np.ceil(n / nx))
    gx, gy = np.meshgrid((np.arange(nx) + 0.5) * length / nx, (np.arange(ny) + 0.5) * width / ny)
    pos = np.stack([gx.ravel(), gy.ravel()], axis=1)[:n]
    for x, y in pos:
        sim.add_agent(jps.CollisionFreeSpeedModelAgentParameters(
            journey_id=journey, stage_id=exit_id, position=(float(x), float(y)),
            desired_speed=float(np.clip(rng.normal(1.34, 0.26), 0.5, 2.0))))
    last = {a.id: tuple(a.position) for a in sim.agents()}
    speeds = []
    steps = int(t_sim / dt)
    for k in range(steps):
        sim.iterate()
        if k % 50 == 0 and k * dt > 2.0:
            cur = {a.id: tuple(a.position) for a in sim.agents()}
            for aid, (x, _y) in cur.items():
                if aid in last and measure[0] <= x <= measure[1]:
                    speeds.append((x - last[aid][0]) / (50 * dt))
            last = cur
        elif k % 50 == 0:
            last = {a.id: tuple(a.position) for a in sim.agents()}
    return float(np.mean(speeds)) if speeds else float("nan")
