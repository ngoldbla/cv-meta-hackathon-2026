"""Anchor check (spec §7): b0 on the held-out anchor days must reproduce the observed anchor targets.

    python -m ems.sim.anchor_check     # writes calibration/anchor_report.json and anchor_report.md; exit 1 on failure
"""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta

import numpy as np

from .calib import CAL
from .fit import run_days

TOL = {"p50": 0.10, "p90": 0.15, "held_abs": 0.03, "transports": 0.05, "offload": 0.10, "flu_abs": 0.05}


def metrics(results: list[dict]) -> dict:
    resp, tiers, held, tr, off = [], [], [], [], []
    for r in results:
        n = len(r["held_obs"])
        resp.append((r["t_scene"][:n] - r["t_call"][:n]) / 60)
        tiers.append(r["tier"][:n])
        held.append(r["held"][:n])
        tr.append(r["transported"][:n].sum())
        off.append(r["offload_s"][:n])
    resp, tiers, held, off = map(np.concatenate, (resp, tiers, held, off))
    out = {"tiers": {}, "held_share": float(held.mean()), "transports_per_day": float(np.mean(tr)),
           "offload_median_min": float(np.nanmedian(off) / 60)}
    for t in (1, 2, 3):
        x = resp[(tiers == t) & np.isfinite(resp)]
        out["tiers"][str(t)] = {"p50_min": float(np.percentile(x, 50)), "p90_min": float(np.percentile(x, 90))}
    return out


def compare(sim: dict, obs: dict, sim_flu: float, obs_flu: float) -> list[dict]:
    rows = []

    def rel(name, s, o, tol):
        rows.append({"check": name, "sim": s, "obs": o, "tol": f"±{tol:.0%}", "ok": abs(s - o) <= tol * abs(o)})

    def ab(name, s, o, tol):
        rows.append({"check": name, "sim": s, "obs": o, "tol": f"±{tol:.2f}", "ok": abs(s - o) <= tol})

    for t in ("1", "2", "3"):
        rel(f"tier {t} response p50 (min)", sim["tiers"][t]["p50_min"], obs["tiers"][t]["p50_min"], TOL["p50"])
        rel(f"tier {t} response p90 (min)", sim["tiers"][t]["p90_min"], obs["tiers"][t]["p90_min"], TOL["p90"])
    ab("held share", sim["held_share"], obs["held_share"], TOL["held_abs"])
    rel("transports per day", sim["transports_per_day"], obs["transports_per_day"], TOL["transports"])
    rel("offload median (min)", sim["offload_median_min"], obs["offload_median_min"], TOL["offload"])
    ab("Jan 2018 held-share increase", sim_flu, obs_flu, TOL["flu_abs"])
    return rows


def main() -> int:
    anchor = json.loads((CAL / "anchor_days.json").read_text())
    targets = json.loads((CAL / "anchor_targets.json").read_text())
    inputs = json.loads((CAL / "sim_inputs.json").read_text())
    normal = [date.fromisoformat(x) for x in anchor["normal_2019"]]
    flu = sorted(date.fromisoformat(x) for x in anchor["flu_2018"])
    base = sorted({flu[0] - timedelta(k) for k in range(1, 29)} - set(flu))
    sim_normal = metrics(run_days(normal, inputs))
    held_flu = metrics(run_days(flu, inputs))["held_share"]
    held_base = metrics(run_days(base, inputs))["held_share"]
    rows = compare(sim_normal, targets["normal"], held_flu - held_base, targets["flu"]["held_share_increase"])
    ok = all(r["ok"] for r in rows)
    (CAL / "anchor_report.json").write_text(json.dumps({"pass": ok, "rows": rows}, indent=1) + "\n")
    md = ["# EMS anchor report (b0 on held-out anchor days)", "", f"Overall: {'PASS' if ok else 'FAIL'}", "",
          "| check | sim | observed | tolerance | ok |", "|---|---|---|---|---|"]
    md += [f"| {r['check']} | {r['sim']:.3f} | {r['obs']:.3f} | {r['tol']} | {'yes' if r['ok'] else 'NO'} |" for r in rows]
    (CAL / "anchor_report.md").write_text("\n".join(md) + "\n")
    print("\n".join(md))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
