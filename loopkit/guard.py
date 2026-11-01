"""Frozen-path guard for the program (the logic behind scripts/guard_paths.py; both are frozen).

Frozen = PROGRAM_FROZEN  +  every judges/<judge>/FROZEN manifest  +  each path a manifest lists
(relative to its judge directory).  Any judges/<judge>/FROZEN path is frozen even before it exists,
so adding a judge's manifest needs the maintainer unlock.  research/ledger.jsonl may only grow by
appending.  A maintainer unlocks one commit with ``git config loopkit.unfreeze maintainer``.

    python scripts/guard_paths.py --staged          # git pre-commit
    python scripts/guard_paths.py path [path ...]   # exit 1 if any path is frozen
    echo '{"tool_input": {"file_path": "..."}}' | python scripts/guard_paths.py --hook   # exit 2 = block
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

PROGRAM_FROZEN = {"scripts/guard_paths.py", "loopkit/__init__.py", "loopkit/guard.py", "loopkit/ledger.py",
                  "loopkit/stats.py"}
APPEND_ONLY = {"research/ledger.jsonl"}
UNFREEZE_KEY = "loopkit.unfreeze"
MANIFEST = re.compile(r"^judges/[^/]+/FROZEN$")


def _root() -> Path:
    out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip()
    return Path(out or ".").resolve()


def frozen_set(root: Path) -> set[str]:
    fs = set(PROGRAM_FROZEN)
    for m in sorted(Path(root).glob("judges/*/FROZEN")):
        judge = m.parent.name
        fs.add(f"judges/{judge}/FROZEN")
        for line in m.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                fs.add(f"judges/{judge}/{line}")
    return fs


def _norm(p: str, root: Path) -> str:
    try:
        return Path(p).resolve().relative_to(Path(root).resolve()).as_posix() if Path(p).is_absolute() else \
            Path(p).as_posix()
    except ValueError:
        return p


def check(paths: list[str], root: Path) -> list[str]:
    fs = frozen_set(root)
    out = []
    for p in paths:
        rel = _norm(p, root)
        if rel in fs or MANIFEST.match(rel):
            out.append(rel)
    return out


def ledger_append_only() -> bool:
    head = subprocess.run(["git", "show", "HEAD:research/ledger.jsonl"], capture_output=True, text=True).stdout
    staged = subprocess.run(["git", "show", ":research/ledger.jsonl"], capture_output=True, text=True).stdout
    return staged.startswith(head)


def main(argv: list[str]) -> int:
    root = _root()
    if argv and argv[0] == "--hook":
        data = json.load(sys.stdin)
        path = (data.get("tool_input") or {}).get("file_path") or ""
        if check([path], root):
            print(f"blocked: {path} is frozen (see judges/*/FROZEN and loopkit/guard.py)", file=sys.stderr)
            return 2
        return 0
    if argv and argv[0] == "--staged":
        names = subprocess.run(["git", "diff", "--cached", "--name-only"], capture_output=True,
                               text=True).stdout.split()
        bad = check(names, root)
        if any(n in APPEND_ONLY for n in names) and not ledger_append_only():
            bad.append("research/ledger.jsonl (rewritten, not appended)")
        allow = subprocess.run(["git", "config", "--get", UNFREEZE_KEY], capture_output=True, text=True).stdout.strip()
        if bad and allow != "maintainer":
            print("frozen paths changed:", ", ".join(bad), file=sys.stderr)
            return 1
        return 0
    bad = check(argv, root)
    for b in bad:
        print("frozen:", b)
    return 1 if bad else 0
