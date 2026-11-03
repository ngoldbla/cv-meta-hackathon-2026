"""Secret guard: fail if a commit would add an API key to this public repository.

Two checks on the lines a commit adds (or on every tracked file with --all):
1. Key-shaped strings: listings-provider tokens, Meta Model API keys, private keys, and
   KEY=/TOKEN=/SECRET= assignments that carry a long literal value.
2. The exact values in ~/.config/low-key/env (if it exists). They are read at run time and
   never printed; this file holds no secrets.

Usage:  python scripts/secret_guard.py          (staged changes; used by the pre-commit hook)
        python scripts/secret_guard.py --all    (every tracked file)
"""

from __future__ import annotations

import os
import re
import subprocess
import sys

ENV_FILE = os.path.expanduser("~/.config/low-key/env")
PATTERNS = [
    re.compile(r"vis_(?:live|test)_[A-Za-z0-9]{16,}"),
    re.compile(r"\bLLM_\d{6,}_[A-Za-z0-9_-]{16,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"(?i)\b[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET)\s*[=:]\s*['\"]?[A-Za-z0-9_\-]{24,}"),
]


def _env_values() -> list[str]:
    try:
        lines = open(ENV_FILE, encoding="utf-8").read().splitlines()
    except OSError:
        return []
    vals = []
    for line in lines:
        if "=" in line and not line.lstrip().startswith("#"):
            v = line.split("=", 1)[1].strip().strip("'\"")
            if len(v) >= 16 and not v.startswith("http"):
                vals.append(v)
    return vals


def _git(*args: str) -> str:
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout


def scan(all_files: bool = False) -> list[str]:
    secrets = _env_values()
    problems: list[str] = []
    if all_files:
        chunks = []
        for path in _git("ls-files").splitlines():
            try:
                chunks.append((path, open(path, encoding="utf-8").read()))
            except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
                continue
    else:
        diff = _git("diff", "--cached", "--no-color", "-U0")
        chunks, path, added = [], "?", []
        for line in diff.splitlines():
            if line.startswith("+++ "):
                if added:
                    chunks.append((path, "\n".join(added)))
                path, added = line[6:] if line.startswith("+++ b/") else line[4:], []
            elif line.startswith("+") and not line.startswith("+++"):
                added.append(line[1:])
        if added:
            chunks.append((path, "\n".join(added)))
    for path, text in chunks:
        if path == "scripts/secret_guard.py":
            continue
        if any(s in text for s in secrets):
            problems.append(f"{path}: contains a value from {ENV_FILE}")
        for pat in PATTERNS:
            if pat.search(text):
                problems.append(f"{path}: key-shaped string ({pat.pattern[:28]}...)")
    return problems


def main() -> int:
    problems = scan(all_files="--all" in sys.argv)
    if problems:
        print("secret_guard: refusing; possible secret in:", file=sys.stderr)
        for p in problems:
            print("  " + p, file=sys.stderr)
        print("Keys belong in ~/.config/low-key/env or the host's secret store, never in git.", file=sys.stderr)
        return 1
    print("secret_guard: clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
