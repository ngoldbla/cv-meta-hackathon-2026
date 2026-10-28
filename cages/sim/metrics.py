"""Ground-truth and operator-view metrics.  Tails, not means, are the primary targets."""

from __future__ import annotations

import numpy as np

from .line import DOWN, UP


def _cvar(x: np.ndarray, alpha: float = 0.95) -> float:
    if x.size == 0:
        return float("nan")
    k = max(1, int(np.ceil((1 - alpha) * x.size)))
    return float(np.mean(np.sort(x)[-k:]))


def _pct(x: np.ndarray, q: float) -> float:
    return float(np.percentile(x, q)) if x.size else float("nan")


def evaluate(sim) -> dict:
    t_end = sim.t_end if sim.t_end is not None else sim.now
    L = sim.L
    ev = L.event_station
    done = sim.done
    waiting = [p for p in sim.pax.values() if p.t_arrive <= t_end]
    waits = np.array([b.t_board - b.t_arrive for b in done] + [t_end - p.t_arrive for p in waiting])
    klass = [b.klass for b in done] + [p.klass for p in waiting]
    stream = [b.stream for b in done] + [p.stream for p in waiting]
    wc = waits[np.array([k == "wheelchair" for k in klass], dtype=bool)] if waits.size else waits
    evac = waits[np.array([s == "evac" for s in stream], dtype=bool)] if waits.size else waits
    logged = np.array([b.logged_wait for b in done])
    true_boarded = np.array([b.t_board - b.t_arrive for b in done])
    left = np.array([b.n_left_behind for b in done])
    # danger time includes the interval since each density's last change
    danger = dict(sim.danger_time)
    for key, (t_prev, v) in sim._dens.items():
        if v >= L.rho_danger and t_end > t_prev:
            danger[key] = danger.get(key, 0.0) + (t_end - t_prev)
    plat_peak = max(sim.peak_density.get(("plat", ev, d), 0.0) for d in (UP, DOWN))
    plaza_peak = sim.peak_density.get(("plaza", ev), 0.0)
    evac_boards = [b.t_board for b in done if b.stream == "evac"]
    # NFPA 130 reference (not a certification): evacuees who stood on the platform for over 4 minutes
    on_plat = np.array([b.t_board - b.t_platform for b in done if b.stream == "evac" and b.t_platform is not None])
    n_evac_left = sum(1 for p in waiting if p.stream == "evac")
    return {
        "n_passengers": int(waits.size),
        "n_censored": len(waiting),
        "awt": float(waits.mean()) if waits.size else float("nan"),
        "p50": _pct(waits, 50),
        "p95": _pct(waits, 95),
        "p99": _pct(waits, 99),
        "cvar95": _cvar(waits),
        "max_wait": float(waits.max()) if waits.size else float("nan"),
        "evac_p95": _pct(evac, 95),
        "evac_cvar95": _cvar(evac),
        "wheelchair_p95": _pct(wc, 95),
        "logger_awt": float(logged.mean()) if logged.size else float("nan"),
        "logger_p95": _pct(logged, 95),
        "logger_understatement": float(1 - logged.mean() / true_boarded.mean())
        if logged.size and true_boarded.mean() > 0 else float("nan"),
        "stranded_frac": float(np.mean(left > 0)) if left.size else 0.0,
        "strand_events": int(left.sum()) if left.size else 0,
        "logged_stranded_frac": 0.0,  # passenger counters and train logs cannot see left-behinds
        "peak_platform_density": float(plat_peak),
        "peak_plaza_density": float(plaza_peak),
        "peak_density": float(max(plat_peak, plaza_peak)),
        "danger_s_platform": float(sum(danger.get(("plat", ev, d), 0.0) for d in (UP, DOWN))),
        "danger_s_plaza": float(danger.get(("plaza", ev), 0.0)),
        "platform_over_4min_frac": float(np.mean(on_plat > 240.0)) if on_plat.size else float("nan"),
        "clearance_s": float(max(evac_boards) - sim.t_onset) if evac_boards and n_evac_left == 0 else float("nan"),
        "n_calls": len(sim.call_log),
        "express_runs": int(sum(1 for c in sim.call_log if c.vehicle and c.vehicle[0] == "train")),
        "bus_boarded": int(sim.bus_boarded),
        "backtrack": int(sim.n_backtrack),
        "train_km": float(sum(t.km for t in sim.trains)),
        "t_end": float(t_end),
        "deadlocked": bool(sim.deadlocked),
    }
