"""Audit one autoresearch loop: the jsonl log is well formed, every keep/revert decision follows the rule,
and the loop's branch changed only files in scope (and no frozen path).

    python scripts/ar_check.py --log research/autoresearch/<slug>/autoresearch.jsonl --direction lower \
        --scope experiments/ar/cages_blue_config.json --branch ar/blue/<slug> --base main
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

REQUIRED = {"iter", "time", "commit", "hypothesis", "files", "metric", "value", "best_before", "decision",
            "evidence", "seconds"}
DECISIONS = {"baseline", "keep", "revert", "crash"}


def check_log(entries: list[dict], direction: str) -> list[str]:
    """Problems in an autoresearch log; an empty list means it follows the keep/revert rule."""
    if direction not in ("lower", "higher"):
        raise ValueError("direction must be 'lower' or 'higher'")
    if not entries or entries[0].get("decision") != "baseline":
        return ["the first entry must be the baseline"]
    problems: list[str] = []
    best = None
    for i, e in enumerate(entries):
        missing = REQUIRED - e.keys()
        if missing:
            problems.append(f"entry {i}: missing {sorted(missing)}")
            continue
        if e["iter"] != i:
            problems.append(f"entry {i}: iter is {e['iter']}")
        d = e["decision"]
        if d not in DECISIONS:
            problems.append(f"entry {i}: unknown decision {d!r}")
            continue
        if d == "baseline":
            if i != 0:
                problems.append(f"entry {i}: a second baseline")
            best = e["value"]
            continue
        if e["best_before"] != best:
            problems.append(f"entry {i}: best_before {e['best_before']} but the best so far is {best}")
        if d == "crash":
            continue
        better = e["value"] < best if direction == "lower" else e["value"] > best
        if d == "keep" and not better:
            problems.append(f"entry {i}: kept without improving on {best}")
        if d == "revert" and better:
            problems.append(f"entry {i}: reverted an improvement over {best}")
        if d == "keep":
            best = e["value"]
    return problems


def check_scope(changed: list[str], scope: list[str], log_dir: str) -> list[str]:
    """Files a loop branch changed outside its scope, its own log directory and the journal."""
    prefix = log_dir.rstrip("/") + "/"
    allowed = set(scope) | {"research/journal.md"}
    return [f"out of scope: {p}" for p in changed if p not in allowed and not p.startswith(prefix)]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--log", required=True)
    ap.add_argument("--direction", required=True, choices=["lower", "higher"])
    ap.add_argument("--scope", required=True, help="comma-separated files in scope")
    ap.add_argument("--branch", required=True)
    ap.add_argument("--base", default="main")
    a = ap.parse_args(argv)
    entries = [json.loads(line) for line in Path(a.log).read_text().splitlines() if line.strip()]
    problems = check_log(entries, a.direction)
    changed = subprocess.run(["git", "diff", "--name-only", f"{a.base}...{a.branch}"], capture_output=True,
                             text=True, check=True).stdout.split()
    problems += check_scope(changed, [s for s in a.scope.split(",") if s], str(Path(a.log).parent))
    frozen = subprocess.run([sys.executable, "scripts/guard_paths.py", *changed], capture_output=True, text=True)
    if frozen.returncode:
        problems.append("frozen paths changed: " + frozen.stdout.strip())
    for p in problems:
        print(p)
    print(f"{len(entries)} entries, {len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
