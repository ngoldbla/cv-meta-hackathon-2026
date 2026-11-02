"""Hold-rule ablation (dev only): which part of BLUE_ONLY's policy gives its extra gain, and which part hurts calm days.

Same fresh pool as pre_m6_recheck.py: dev_pool(200, seed 1001). Variants are written next to this file in ablation/
from the hashed finals in final/ (ledger seq 20). Results by b1-load quartile, primary (8:3:1) and equal weights.
"""

import json
from pathlib import Path

import numpy as np

import ems.evaluate as ev
from emslearn.cli import pool

M6 = Path(__file__).resolve().parent
F, A = M6 / "final", M6 / "ablation"


def variant(name: str, src: Path, subs: list[tuple[str, str]]) -> str:
    text = src.read_text()
    for old, new in subs:
        assert old in text, (name, old)
        text = text.replace(old, new)
    d = A / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "ems_candidate.py").write_text(text)  # no .npz: the unit choice is b1's nearest unit
    return f"file:{d / 'ems_candidate.py'}:Candidate"


def main():
    bo, nc = F / "blue-only" / "ems_candidate.py", F / "no-cf" / "ems_candidate.py"
    gate = "(waited_s < 300.0))"
    pols = {
        "b1": "b1",
        "blue-only final": f"file:{bo}:Candidate",
        "no-cf final": f"file:{nc}:Candidate",
        "bo rules, no model": variant("bo-rules", bo, []),
        "bo rules, no model, 3-unit surge": variant("bo-rules-n3", bo, [('{"activate_n": 2, ', "{")]),
        "no-cf + 16-call gate": variant("nc-gate16", nc, [(gate, "(waited_s < 300.0) & (x[:, 7] >= 1.6))")]),
        "no-cf + 10-min hold": variant("nc-10min", nc, [("waited_s < 300.0", "waited_s < 600.0")]),
        "no-cf + 2-unit surge": variant("nc-n2", nc, [("    weights_path = Path(__file__).with_suffix(\".npz\")\n",
                                                        "    weights_path = Path(__file__).with_suffix(\".npz\")\n\n"
                                                        "    def __init__(self, params=None):\n"
                                                        "        super().__init__({\"activate_n\": 2, **(params or {})})\n")]),
    }
    scen = pool(200, 1001, None, 0)
    rows = ev.run_pool(scen, list(pols.values()), 24)
    b = np.array([r["primary"] for r in rows["b1"]])
    q = np.quantile(b, [0.25, 0.5, 0.75])
    bands = {"all": b >= 0, "calmest 25%": b < q[0], "25-50%": (b >= q[0]) & (b < q[1]),
             "50-75%": (b >= q[1]) & (b < q[2]), "busiest 25%": b >= q[2]}
    out = {}
    for name, p in pols.items():
        if name == "b1":
            continue
        res = {}
        for band, m in bands.items():
            res[band] = {w: round(float(np.array([r[w] for r in rows[p]])[m].mean()
                                        / np.array([r[w] for r in rows["b1"]])[m].mean()), 4) for w in ("primary", "equal")}
        res["held_share"] = round(float(np.mean([r["held_share"] for r in rows[p]])), 4)
        res["unit_hours_extra"] = round(float(np.mean([r["unit_hours_extra"] for r in rows[p]])), 1)
        out[name] = res
        print(json.dumps({name: res}), flush=True)
    (M6 / "ablation.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
