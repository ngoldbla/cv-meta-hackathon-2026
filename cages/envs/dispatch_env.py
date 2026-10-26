"""Gymnasium environment: assign each hall call to a car (semi-MDP over call registrations).

Observation: the observable decision features (car, floor and global tokens + valid-car mask).
Action: car index.  Reward: minus the tail-aware ground-truth waiting cost accrued since the
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

from ..controllers import ESAPlanner
from ..controllers.base import Controller
from ..data.features import N_FLOOR, N_GLOBAL, car_dim, decision_features
from ..data.instances import build_scenario, make_specs
from ..forecast import ScheduleForecaster
from ..sim import Simulation, evaluate, waiting_cost


class _AgentController(Controller):
    name = "agent"

    def __init__(self, env):
        self.env = env

    def assign(self, sim, call, exclude=()):
        obs = decision_features(sim, call, self.env.forecaster, self.env.esa)
        for i in exclude:
            obs["mask"][i] = False
        self.env._to_agent.put(("obs", obs, sim.now))
        a = self.env._to_sim.get()
        if a is None:
            raise SystemExit
        return int(a) if obs["mask"][int(a)] else int(np.flatnonzero(obs["mask"])[0])


class DispatchEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(self, split: str = "train", n_instances: int = 50, specs: list | None = None, tau: float = 60.0):
        self.specs = specs or make_specs(split, n_instances)
        n_f, n_c = 30, 6
        self.observation_space = spaces.Dict({
            "car": spaces.Box(-np.inf, np.inf, (n_c, car_dim(n_f)), np.float32),
            "floor": spaces.Box(-np.inf, np.inf, (n_f, N_FLOOR), np.float32),
            "glob": spaces.Box(-np.inf, np.inf, (N_GLOBAL,), np.float32),
            "mask": spaces.MultiBinary(n_c),
        })
        self.action_space = spaces.Discrete(n_c)
        self.tau = tau
        self.forecaster, self.esa = ScheduleForecaster(), ESAPlanner()
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
        return {"car": o["car"], "floor": o["floor"], "glob": o["glob"], "mask": o["mask"].astype(np.int8)}

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self._shutdown()
        spec = self.specs[int(self.np_random.integers(len(self.specs)))]
        self._to_agent, self._to_sim = queue.Queue(), queue.Queue()
        self.sim = Simulation(build_scenario(spec), _AgentController(self))
        self._t_prev = 0.0
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()
        kind, obs, t = self._to_agent.get()
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

    if "cages/Dispatch-v0" not in gym.registry:
        _reg(id="cages/Dispatch-v0", entry_point="cages.envs.dispatch_env:DispatchEnv")
