"""Record the SHA-256 of every frozen file in the ledger (maintainer only, inside an unlock).

    python scripts/record_freeze.py --reason "M3a restructure" [--scope program]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from loopkit.guard import frozen_set  # noqa: E402
from loopkit.ledger import Ledger, file_sha256, repo_root  # noqa: E402


def frozen_hashes(root: Path) -> dict[str, str]:
    root = Path(root)
    return {p: file_sha256(str(root / p)) for p in sorted(frozen_set(root)) if (root / p).is_file()}


def record(root: Path, ledger: Ledger, reason: str, scope: str = "program") -> dict:
    return ledger.append("evaluator_update", {"scope": scope, "reason": reason, "frozen_sha256": frozen_hashes(root)})


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reason", required=True)
    ap.add_argument("--scope", default="program")
    a = ap.parse_args(argv)
    root = repo_root(Path.cwd())
    print(json.dumps(record(root, Ledger(root / "research" / "ledger.jsonl"), a.reason, a.scope), indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
