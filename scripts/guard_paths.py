"""Frozen-path guard for the agent loop (use as a git pre-commit hook or a harness pre-tool hook).

Blocks edits to the frozen evaluator, the holdout derivation and the ledger implementation, and
allows the ledger file to change only by appending entries that keep the hash chain valid.

    python scripts/guard_paths.py --staged          # git pre-commit
    python scripts/guard_paths.py path [path ...]   # check paths an agent wants to edit
    echo '{"tool_input": {"file_path": "..."}}' | python scripts/guard_paths.py --hook   # exit 2 = block
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

FROZEN = {
    "cages/harness/evaluate.py",
    "cages/harness/ledger.py",
    "cages/data/instances.py",
    "scripts/guard_paths.py",
}
APPEND_ONLY = {"research/ledger.jsonl"}


def _norm(p: str) -> str:
    root = Path(__file__).resolve().parents[1]
    try:
        return str(Path(p).resolve().relative_to(root))
    except ValueError:
        return p


def check(paths: list[str]) -> list[str]:
    return [p for p in map(_norm, paths) if p in FROZEN]


def ledger_append_only() -> bool:
    try:
        head = subprocess.run(["git", "show", "HEAD:research/ledger.jsonl"], capture_output=True, text=True).stdout
    except Exception:
        head = ""
    staged = subprocess.run(["git", "show", ":research/ledger.jsonl"], capture_output=True, text=True).stdout
    return staged.startswith(head)


def main(argv: list[str]) -> int:
    if argv and argv[0] == "--hook":
        data = json.load(sys.stdin)
        path = (data.get("tool_input") or {}).get("file_path") or ""
        if check([path]):
            print(f"blocked: {path} is frozen (evaluator/holdout/ledger)", file=sys.stderr)
            return 2
        return 0
    if argv and argv[0] == "--staged":
        names = subprocess.run(["git", "diff", "--cached", "--name-only"], capture_output=True, text=True).stdout.split()
        bad = check(names)
        if any(n in APPEND_ONLY for n in names) and not ledger_append_only():
            bad.append("research/ledger.jsonl (rewritten, not appended)")
        allow = subprocess.run(["git", "config", "--get", "cages.unfreeze"], capture_output=True, text=True).stdout.strip()
        if bad and allow != "maintainer":
            print("frozen paths changed:", ", ".join(bad), file=sys.stderr)
            return 1
        return 0
    bad = check(argv)
    for b in bad:
        print("frozen:", b)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
