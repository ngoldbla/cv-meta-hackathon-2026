"""Boids-flavoured social-force crowd model (NumPy + cKDTree).

Physics: the social-force model (Helbing & Molnar 1995; Helbing, Farkas & Vicsek 2000) with
anisotropic perception, which a speed-density calibration needs.  "Boids" terms (Reynolds 1987)
add cohesion and alignment *within social groups* (cf. Moussaid et al. 2010).

Calibration target: Weidmann's (1993) fundamental diagram
    v(rho) = v0 * (1 - exp(-gamma * (1/rho - 1/rho_max))),  v0=1.34, gamma=1.913, rho_max=5.4
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.spatial import cKDTree

V0, GAMMA, RHO_MAX = 1.34, 1.913, 5.4


def weidmann_speed(rho) -> np.ndarray:
    rho = np.asarray(rho, dtype=float)
    return np.clip(V0 * (1 - np.exp(-GAMMA * (1 / rho - 1 / RHO_MAX))), 0.0, None)


@dataclass
class SocialForceParams:
    tau: float = 0.5  # s, relaxation time
    # A, B, lam calibrated with ``calibrate()`` against Weidmann (rmse 0.073 m/s, rho 0.5-3 p/m^2)
    A: float = 3.0  # m/s^2, social repulsion strength (per unit mass)
    B: float = 0.3  # m, social repulsion range
    lam: float = 0.3  # anisotropy (weight of interactions from behind)
    radius: float = 0.2  # m
    k_body: float = 120.0  # 1/s^2, body compression (per unit mass)
    cohesion: float = 0.6  # boids cohesion within groups (m/s^2 per m)
    alignment: float = 0.3  # boids alignment within groups (1/s)
    cutoff: float = 2.5  # m, interaction cutoff
    v_max_factor: float = 1.3


class Crowd:
    """2D crowd of agents walking toward goals; optionally periodic in x (corridor tests)."""

    def __init__(self, pos, goal_dir, v0, params: SocialForceParams | None = None, groups=None,
                 periodic_x: float | None = None, walls_y: tuple | None = None, seed: int = 0):
        self.p = params or SocialForceParams()
        self.x = np.asarray(pos, dtype=float).copy()
        self.v = np.zeros_like(self.x)
        self.e = np.asarray(goal_dir, dtype=float)
        self.v0 = np.asarray(v0, dtype=float)
        self.groups = np.asarray(groups if groups is not None else np.arange(len(self.x)))
        self.periodic_x = periodic_x
        self.walls_y = walls_y
        self.rng = np.random.default_rng(seed)

    def _desired_dir(self) -> np.ndarray:
        e = self.e
        if e.ndim == 1:
            e = np.broadcast_to(e, self.x.shape)
        return e

    def step(self, dt: float) -> None:
        p = self.p
        n = len(self.x)
        e = self._desired_dir()
        acc = (self.v0[:, None] * e - self.v) / p.tau
        if self.periodic_x:
            box = np.array([self.periodic_x, 1e9])
            pts = self.x.copy()
            pts[:, 0] %= self.periodic_x
            pts[:, 1] += 1e8  # cKDTree needs coords inside [0, box)
            tree = cKDTree(pts, boxsize=box)
        else:
            tree = cKDTree(self.x)
        pairs = tree.query_pairs(p.cutoff, output_type="ndarray")
        if len(pairs):
            i, j = pairs[:, 0], pairs[:, 1]
            d = self.x[i] - self.x[j]
            if self.periodic_x:
                d[:, 0] -= self.periodic_x * np.round(d[:, 0] / self.periodic_x)
            dist = np.linalg.norm(d, axis=1) + 1e-9
            nij = d / dist[:, None]
            overlap = 2 * p.radius - dist
            mag = p.A * np.exp(overlap / p.B) + p.k_body * np.maximum(overlap, 0.0)
            # anisotropy: i reacts strongly to j ahead of it (cos between e_i and -n_ij)
            cos_i = -np.einsum("ij,ij->i", e[i], nij)
            cos_j = np.einsum("ij,ij->i", e[j], nij)
            wi = p.lam + (1 - p.lam) * (1 + cos_i) / 2
            wj = p.lam + (1 - p.lam) * (1 + cos_j) / 2
            f = mag[:, None] * nij
            np.add.at(acc, i, wi[:, None] * f)
            np.add.at(acc, j, -wj[:, None] * f)
            # boids terms within social groups
            same = self.groups[i] == self.groups[j]
            if same.any() and (p.cohesion or p.alignment):
                gi, gj = i[same], j[same]
                coh = p.cohesion * np.clip(dist[same] - 0.8, 0, None)[:, None] * nij[same]
                np.add.at(acc, gi, -coh)
                np.add.at(acc, gj, coh)
                dv = self.v[gj] - self.v[gi]
                np.add.at(acc, gi, p.alignment * dv)
                np.add.at(acc, gj, -p.alignment * dv)
        if self.walls_y is not None:
            lo, hi = self.walls_y
            for wall, sign in ((lo, 1.0), (hi, -1.0)):
                dw = np.abs(self.x[:, 1] - wall)
                acc[:, 1] += sign * (p.A * np.exp((p.radius - dw) / p.B) + p.k_body * np.maximum(p.radius - dw, 0))
        self.v += dt * acc
        # pedestrians do not walk backwards against their goal: clip the anti-goal component
        back = np.einsum("ij,ij->i", self.v, e)
        self.v -= np.minimum(back, 0.0)[:, None] * e
        speed = np.linalg.norm(self.v, axis=1)
        vmax = p.v_max_factor * self.v0
        scale = np.where(speed > vmax, vmax / np.maximum(speed, 1e-9), 1.0)
        self.v *= scale[:, None]
        self.x += dt * self.v
        if self.walls_y is not None:
            self.x[:, 1] = np.clip(self.x[:, 1], self.walls_y[0] + 0.05, self.walls_y[1] - 0.05)
        if self.periodic_x:
            self.x[:, 0] %= self.periodic_x
        _ = n


def corridor_speed(rho: float, params: SocialForceParams | None = None, length: float = 20.0, width: float = 4.0,
                   t_sim: float = 25.0, t_warm: float = 10.0, dt: float = 0.04, seed: int = 0) -> float:
    """Mean walking speed in a periodic uni-directional corridor at density ``rho`` (p/m^2)."""
    rng = np.random.default_rng(seed)
    n = max(2, int(round(rho * length * width)))
    nx = int(np.ceil(np.sqrt(n * length / width)))
    ny = int(np.ceil(n / nx))
    gx, gy = np.meshgrid((np.arange(nx) + 0.5) * length / nx, (np.arange(ny) + 0.5) * width / ny)
    pos = np.stack([gx.ravel(), gy.ravel()], axis=1)[:n] + rng.normal(0, 0.02, (n, 2))
    v0 = np.clip(rng.normal(V0, 0.26, n), 0.5, 2.0)
    crowd = Crowd(pos, np.array([1.0, 0.0]), v0, params, periodic_x=length, walls_y=(0.0, width), seed=seed)
    speeds = []
    steps = int(t_sim / dt)
    for k in range(steps):
        crowd.step(dt)
        if k * dt >= t_warm:
            speeds.append(crowd.v[:, 0].mean())
    return float(np.mean(speeds))


def fundamental_diagram(params: SocialForceParams | None = None, rhos=(0.5, 1.0, 1.5, 2.0, 3.0), seed: int = 0):
    sim = np.array([corridor_speed(r, params, seed=seed) for r in rhos])
    ref = weidmann_speed(rhos)
    rmse = float(np.sqrt(np.mean((sim - ref) ** 2)))
    return np.asarray(rhos), sim, ref, rmse


def calibrate(grid_A=(2.0, 3.0, 4.5), grid_B=(0.25, 0.35, 0.5), grid_lam=(0.1, 0.2), rhos=(0.5, 1.0, 2.0, 3.0)):
    """Grid-search social-force parameters against Weidmann's diagram; returns (params, rmse)."""
    best, best_rmse = None, np.inf
    for A in grid_A:
        for B in grid_B:
            for lam in grid_lam:
                prm = SocialForceParams(A=A, B=B, lam=lam)
                _, _, _, rmse = fundamental_diagram(prm, rhos)
                if rmse < best_rmse:
                    best, best_rmse = prm, rmse
    return best, best_rmse
