"""Record the EMS dataset release in the ledger (maintainer only; run by apply-m3d-freeze.sh).

The day tables are git-ignored (NYC Open Data rows stay local), so the release pins them by hash: one SHA-256
per day file, combined into one digest, plus the count. The calibration bundle and the data manifests are
pinned file by file. The sealed holdout manifests carry row counts only (rows never downloaded).
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from loopkit.ledger import Ledger, file_sha256  # noqa: E402

EMS = ROOT / "judges" / "ems"


def payload() -> dict:
    days = sorted((EMS / "data" / "cache" / "days").glob("*.npz"))
    if len(days) != 1095:
        raise SystemExit(f"expected 1095 day tables (2017-2019), found {len(days)}")
    lines = "".join(f"{p.name} {file_sha256(str(p))}\n" for p in days)
    manifests = {p.name: json.loads(p.read_text()) for p in sorted((EMS / "data" / "manifests").glob("*.json"))}
    return {
        "name": "ems-nyc-76xm-jjuj-2017-2019",
        "code_sha": subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip(),
        "source": "NYC Open Data 76xm-jjuj (EMS Incident Dispatch Data)",
        "day_tables": {"count": len(days), "first": days[0].stem, "last": days[-1].stem,
                       "sha256_of_list": hashlib.sha256(lines.encode()).hexdigest()},
        "calibration_sha256": {p.name: file_sha256(str(p)) for p in sorted((EMS / "calibration").iterdir()) if p.is_file()},
        "manifests_sha256": {p.name: file_sha256(str(p)) for p in sorted((EMS / "data" / "manifests").glob("*.json"))},
        "holdout_rows": {k: v.get("rows") for k, v in manifests.items() if k.startswith("holdout-")},
        "holdout_primary": "holdout-omicron-b",
        "holdout_exposure": "covid-a summary statistics were viewed during design on 2026-10-29, before sealing",
    }


if __name__ == "__main__":
    print(json.dumps(Ledger(ROOT / "research" / "ledger.jsonl").append("dataset_release", payload()), indent=1))
