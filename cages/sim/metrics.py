"""Ground-truth and logger-view metrics.  Tails, not means, are the primary targets."""

from __future__ import annotations

import numpy as np


def _cvar(x: np.ndarray, alpha: float = 0.95) -> float:
    if x.size == 0:
        return float("nan")
    k = max(1, int(np.ceil((1 - alpha) * x.size)))
    return float(np.mean(np.sort(x)[-k:]))


def evaluate(sim) -> dict:
    t_end = sim.t_end if sim.t_end is not None else sim.now
    allp = list(sim.done) + list(sim.pax.values())
    arrived = [p for p in allp if p.t_arrive <= t_end]
    waits = np.array([(p.t_board if p.t_board is not None else t_end) - p.t_arrive for p in arrived])
    censored = sum(1 for p in arrived if p.t_board is None)
    wc = np.array([(p.t_board if p.t_board is not None else t_end) - p.t_arrive for p in arrived if p.klass == "wheelchair"])
    ttd = np.array([p.t_alight - p.t_arrive for p in sim.done if p.t_alight is not None])
    calls = [c for c in sim.call_log if c.t_cancel is not None]
    log_waits = np.array([c.t_cancel - c.t_register for c in calls])
    surge = [p for p in sim.done if p.stream in ("egress", "ingress")]
    info = sim.scenario.info()
    ev = info.get("event_floor")
    out = {
        "n_passengers": len(arrived),
        "n_censored": censored,
        "awt": float(waits.mean()) if waits.size else float("nan"),
        "p50": float(np.percentile(waits, 50)) if waits.size else float("nan"),
        "p95": float(np.percentile(waits, 95)) if waits.size else float("nan"),
        "p99": float(np.percentile(waits, 99)) if waits.size else float("nan"),
        "cvar95": _cvar(waits),
        "max_wait": float(waits.max()) if waits.size else float("nan"),
        "wheelchair_p95": float(np.percentile(wc, 95)) if wc.size else float("nan"),
        "time_to_dest": float(ttd.mean()) if ttd.size else float("nan"),
        "logger_awt": float(log_waits.mean()) if log_waits.size else float("nan"),
        "logger_p95": float(np.percentile(log_waits, 95)) if log_waits.size else float("nan"),
        "logger_understatement": float(1 - log_waits.mean() / waits.mean()) if waits.size and log_waits.size and waits.mean() > 0 else float("nan"),
        "stranded_frac": float(np.mean([p.n_left_behind > 0 for p in arrived])) if arrived else 0.0,
        "strand_events": int(sum(p.n_left_behind for p in arrived)),
        "wasted_stops": int(sum(c.n_wasted_stops for c in sim.cars)),
        "starts": int(sum(c.n_starts for c in sim.cars)),
        "floors_travelled": float(sum(c.floors_travelled for c in sim.cars)),
        "peak_lobby_density": float(sim.peak_lobby_density),
        "peak_event_floor_density": float(sim.peak_density.get(ev, 0.0)) if ev is not None else float("nan"),
        "danger_s_lobby": float(sim.danger_time.get(sim.b.lobby_floor, 0.0)),
        "danger_s_event_floor": float(sim.danger_time.get(ev, 0.0)) if ev is not None else float("nan"),
        "clearance_s": float(max(p.t_alight for p in surge) - min(p.t_arrive for p in surge)) if surge else float("nan"),
        "n_calls": len(sim.call_log),
        "t_end": float(t_end),
        "deadlocked": bool(getattr(sim, "deadlocked", False)),
    }
    return out
