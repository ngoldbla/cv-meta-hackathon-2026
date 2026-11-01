"""Record the sealed stress pool in the ledger (maintainer only; run by apply-m4.sh)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from loopkit.ledger import Ledger, file_sha256  # noqa: E402

POOL = ROOT / "judges" / "ems" / "data" / "manifests" / "stress-pool.json"


def payload(red_commit: str) -> dict:
    pool = json.loads(POOL.read_text())
    return {"name": "ems-stress-pool-2016", "pool_sha256": file_sha256(str(POOL)), "days": len(pool["days"]),
            "window": pool["window"], "generator": pool["generator"], "generator_sha256": pool["generator_sha256"],
            "red_run": {"branch": "ar/red/ems-stress", "commit": red_commit, "task": "ops/tasks/014-ems-red-stress.md"},
            "seeds": [0, 1, 2], "made_before": "any blue iteration of M5",
            "code_sha": subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()}


if __name__ == "__main__":
    print(json.dumps(Ledger(ROOT / "research" / "ledger.jsonl").append("dataset_release", payload(sys.argv[1])), indent=1))
