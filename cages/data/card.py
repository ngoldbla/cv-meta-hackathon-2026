"""Dataset documentation: DATASHEET.md (Gebru et al., Datasheets for Datasets) and Croissant metadata.

    python -m cages.data.card datasets/cages-v0-mini
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np

FIELDS = {
    "car": "per-car observable features (n_cars x car_dim)",
    "floor": "per-floor observable features (n_floors x 12)",
    "glob": "global observable features (7)",
    "mask": "valid candidate cars",
    "q_k": "counterfactual tail-aware waiting cost per CRN rollout and candidate car (K x n_cars)",
    "q_mean": "mean counterfactual cost per candidate car",
    "q_std": "std of counterfactual cost across CRN rollouts",
    "best": "index of the counterfactual-best car",
    "esa_choice": "car chosen by the ESA planner baseline",
    "eta_choice": "car chosen by the ETA baseline",
    "t": "decision time (s)",
    "call": "hall call (floor, direction)",
    "instance": "instance id (see specs.jsonl)",
}


def _sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def croissant(root: Path, manifest: dict) -> dict:
    dist = []
    for split in manifest["splits"]:
        for name, fmt in (("shard-000.npz", "application/octet-stream"), ("specs.jsonl", "application/jsonlines")):
            p = root / split / name
            if p.exists():
                dist.append({"@type": "cr:FileObject", "@id": f"{split}/{name}", "name": f"{split}/{name}",
                             "contentUrl": f"{split}/{name}", "encodingFormat": fmt, "sha256": _sha(p)})
    return {
        "@context": {"@vocab": "https://schema.org/", "sc": "https://schema.org/", "cr": "http://mlcommons.org/croissant/"},
        "@type": "sc:Dataset",
        "name": root.name,
        "description": "CAGES: Calibrated, Adversarially Generated Elevator Simulation dataset. Counterfactual-labelled "
                       "elevator dispatch decisions under worst-case crowd surges.",
        "license": "https://creativecommons.org/licenses/by/4.0/",
        "creator": {"@type": "Person", "name": "Dylan Goldblatt"},
        "version": manifest.get("version", "0.1"),
        "conformsTo": "http://mlcommons.org/croissant/1.0",
        "distribution": dist,
        "recordSet": [{"@type": "cr:RecordSet", "name": "decisions",
                       "field": [{"@type": "cr:Field", "name": k, "description": v} for k, v in FIELDS.items()]}],
    }


def datasheet(root: Path, manifest: dict) -> str:
    lines = [
        f"# Datasheet: {root.name}", "",
        "**Motivation.** Real elevator logs can't show what would have happened under a different dispatch decision, and"
        " in crowd surges they hide most of the waiting (one hall call can stand for hundreds of people). CAGES supplies"
        " counterfactual labels for every candidate action, under deliberately worst-case conditions.", "",
        "**Composition.** Each record is one hall-call decision in a 30-floor, 6-car venue tower during an event surge:",
        "- observable features (what a real controller sees);",
        "- for each candidate car, the tail-aware ground-truth waiting cost over a horizon, estimated with common-random-number rollouts.",
        "",
        "| split | instances | labelled states |", "|---|---|---|",
    ]
    for s, v in manifest["splits"].items():
        lines.append(f"| {s} | {v['instances']} | {v['states']} |")
    lines += [
        "", "**Collection process.** Fully synthetic, from the `cages` simulator at code SHA "
        f"`{manifest.get('code_sha', 'unknown')[:12]}`. Label config: `{json.dumps(manifest.get('label_config'))}`.",
        "Car speed and rated load come from real NYC tall elevator banks (NYC Open Data `juyv-2jek`, aggregates only).",
        "Crowd and door parameters are anchored to published statistics (see `anchors/`). Failure-mode severities are drawn",
        "from an inversion regime skewed toward severe conditions.", "",
        "**Uses.**",
        "- Training and evaluating dispatch policies (imitation and offline RL);",
        "- calibration studies;",
        "- estimating how badly logs understate crush waits.", "",
        "Not suitable for certifying real buildings or evacuation procedures.", "",
        "**Fields.**", "",
    ]
    lines += [f"- `{k}`: {v}" for k, v in FIELDS.items()]
    lines += ["", "**Holdout.** The holdout split is generated on demand from a secret salt and is never distributed.",
              "", "**License.** CC BY 4.0 (data); MIT (code). Author: Dylan Goldblatt.", ""]
    return "\n".join(lines)


def stats(root: Path) -> dict:
    out = {}
    for split in ("train", "dev"):
        p = root / split / "shard-000.npz"
        if not p.exists():
            continue
        d = np.load(p)
        q = d["q_mean"]
        rel_gap = (q.max(1) - q.min(1)) / q.mean(1)
        out[split] = {"states": int(len(q)), "median_rel_action_gap": float(np.median(rel_gap)),
                      "esa_matches_best": float((d["esa_choice"] == d["best"]).mean()),
                      "eta_matches_best": float((d["eta_choice"] == d["best"]).mean())}
    return out


def write(root: str) -> dict:
    r = Path(root)
    manifest = json.loads((r / "manifest.json").read_text())
    (r / "croissant.json").write_text(json.dumps(croissant(r, manifest), indent=1))
    (r / "DATASHEET.md").write_text(datasheet(r, manifest))
    s = stats(r)
    (r / "stats.json").write_text(json.dumps(s, indent=1))
    return s


if __name__ == "__main__":
    print(json.dumps(write(sys.argv[1] if len(sys.argv) > 1 else "datasets/cages-v0-mini"), indent=1))
