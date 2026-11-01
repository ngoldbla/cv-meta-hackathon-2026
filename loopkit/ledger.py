"""Append-only, hash-chained research ledger for the whole program (moved from cages/harness/ledger.py in M3).

Every pre-registration, dataset release, training run and evaluation is an entry whose hash covers
the previous entry, so history cannot be rewritten silently.  Confirmatory (holdout) evaluations
must reference a pre-registration committed *earlier* in the chain, and each pre-registration can
be tested on the holdout exactly once.  The ledger file is found from the repository root, which is
the nearest ancestor holding the marker file and a ``research/`` directory.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

MARKER = "AGENTS.md"


def repo_root(start: Path | None = None) -> Path:
    """Nearest ancestor of ``start`` (default: this file) that holds ``AGENTS.md`` and ``research/``."""
    here = Path(start or __file__).resolve()
    for d in (here, *here.parents):
        if (d / MARKER).is_file() and (d / "research").is_dir():
            return d
    raise FileNotFoundError(f"no {MARKER} with a research/ directory above {here}")


DEFAULT = repo_root() / "research" / "ledger.jsonl"


def _h(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def file_sha256(path: str) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class Ledger:
    def __init__(self, path: str | Path = DEFAULT):
        self.path = Path(path)

    def entries(self) -> list[dict]:
        if not self.path.exists():
            return []
        return [json.loads(line) for line in self.path.read_text().splitlines() if line.strip()]

    def verify(self) -> bool:
        prev = "0" * 64
        for e in self.entries():
            body = {k: v for k, v in e.items() if k != "hash"}
            if e.get("prev") != prev or _h(body) != e.get("hash"):
                return False
            prev = e["hash"]
        return True

    def append(self, kind: str, payload: dict, timestamp: float | None = None) -> dict:
        if not self.verify():
            raise RuntimeError("ledger chain is broken; refusing to append")
        entries = self.entries()
        body = {
            "seq": len(entries), "kind": kind, "payload": payload,
            "time": int(timestamp if timestamp is not None else time.time()),
            "prev": entries[-1]["hash"] if entries else "0" * 64,
        }
        entry = {**body, "hash": _h(body)}
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a") as f:
            f.write(json.dumps(entry, sort_keys=True) + "\n")
        return entry

    def preregister(self, prereg_path: str) -> dict:
        text = Path(prereg_path).read_text()
        hid = next((line.split(":", 1)[1].strip() for line in text.splitlines() if line.lower().startswith("id:")), None)
        if not hid:
            raise ValueError("pre-registration must contain an 'id:' line")
        if any(e["kind"] == "prereg" and e["payload"]["id"] == hid for e in self.entries()):
            raise ValueError(f"{hid} already pre-registered")
        return self.append("prereg", {"id": hid, "file": str(prereg_path), "sha256": file_sha256(prereg_path)})

    def prereg(self, hid: str) -> dict | None:
        return next((e for e in self.entries() if e["kind"] == "prereg" and e["payload"]["id"] == hid), None)

    def holdout_used(self, hid: str) -> bool:
        return any(e["kind"] == "holdout_eval" and e["payload"].get("prereg") == hid for e in self.entries())
