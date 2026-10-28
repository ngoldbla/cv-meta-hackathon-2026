"""Gymnasium environment: answer each platform-crowding alert with a vehicle (semi-MDP over alerts).

Observation: the observable decision features (vehicle-slot, station and global tokens + valid-slot mask).
Action: slot index (0 no action, 1-4 nearest trains express, 5 yard train, 6-7 buses).
Reward: minus the tail-aware ground-truth waiting cost accrued since the
previous decision (``info['dt']`` gives elapsed seconds for discounting).  The simulator runs in a
worker thread that blocks inside the controller until the agent acts, so the event-driven core is
used unchanged.
"""

from __future__ import annotations

import queue
import threading

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from ..controllers import ExpressRule, RollingHorizon
from ..controllers.base import Controller
from ..data.features import N_GLOBAL, N_STN, N_VEH, decision_features
from ..data.instances import build_scenario, make_specs
from ..forecast import ScheduleForecaster
from ..sim import N_SLOTS, Simulation, evaluate, waiting_cost


class _AgentController(Controller):
    name = "agent"

    def __init__(self, env):
        self.env = env

    def assign(self, sim, call):
        obs = decision_features(sim, call, self.env.forecaster, self.env.planner, self.env.rule)
        self.env._to_agent.put(("obs", obs, sim.now))
        a = self.env._to_sim.get()
        if a is None:
            raise SystemExit
        return int(a) if obs["mask"][int(a)] else int(np.flatnonzero(obs["mask"])[0])


class EvacuationEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(self, split: str = "train", n_instances: int = 50, specs: list | None = None, tau: float = 60.0):
        self.specs = specs or make_specs(split, n_instances)
        n_s = 22
        self.observation_space = spaces.Dict({
            "veh": spaces.Box(-np.inf, np.inf, (N_SLOTS, N_VEH), np.float32),
            "stn": spaces.Box(-np.inf, np.inf, (n_s, N_STN), np.float32),
            "glob": spaces.Box(-np.inf, np.inf, (N_GLOBAL,), np.float32),
            "mask": spaces.MultiBinary(N_SLOTS),
        })
        self.action_space = spaces.Discrete(N_SLOTS)
        self.tau = tau
        self.forecaster = ScheduleForecaster()
        self.planner, self.rule = RollingHorizon(forecaster=self.forecaster), ExpressRule()
        self._thread = None

    def _shutdown(self):
        if self._thread is not None and self._thread.is_alive():
            self._to_sim.put(None)
            self._thread.join(timeout=5)
        self._thread = None

    def _worker(self):
        try:
            self.sim.run()
        except SystemExit:
            return
        self._to_agent.put(("done", None, self.sim.now))

    def _obs(self, o):
        return {"veh": o["veh"], "stn": o["stn"], "glob": o["glob"], "mask": o["mask"].astype(np.int8)}

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self._shutdown()
        for _ in range(100):  # an instance whose crowd never triggers an alert has no decisions: draw again
            spec = self.specs[int(self.np_random.integers(len(self.specs)))]
            self._to_agent, self._to_sim = queue.Queue(), queue.Queue()
            self.sim = Simulation(build_scenario(spec), _AgentController(self))
            self._thread = threading.Thread(target=self._worker, daemon=True)
            self._thread.start()
            kind, obs, t = self._to_agent.get()
            if kind == "obs":
                break
            self._thread.join(timeout=5)
        self._t_prev = t
        self._last = obs
        return self._obs(obs), {"instance": spec["id"], "t": t}

    def step(self, action):
        self._to_sim.put(int(action))
        kind, obs, t = self._to_agent.get()
        reward = -waiting_cost(self.sim, self._t_prev, t, self.tau) / 1000.0
        dt = t - self._t_prev
        self._t_prev = t
        if kind == "done":
            self._thread.join(timeout=5)
            self._thread = None
            return self._obs(self._last), reward, True, False, {"dt": dt, "metrics": evaluate(self.sim)}
        self._last = obs
        return self._obs(obs), reward, False, False, {"dt": dt}

    def close(self):
        self._shutdown()


def register() -> None:
    from gymnasium.envs.registration import register as _reg

    if "cages/Evacuation-v0" not in gym.registry:
        _reg(id="cages/Evacuation-v0", entry_point="cages.envs.evacuation_env:EvacuationEnv")
