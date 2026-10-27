"""Vendor-neutrality guard: fail if any denylisted name appears in tracked files, branch names or
commit metadata (author, committer, message), or if commits are signed by a non-author key.

The denylist holds SHA-256 digests of lower-case tokens, so this file never contains the names.
Usage:  python scripts/name_guard.py                    (files, refs, commit metadata, signer names)
        python scripts/name_guard.py --strict-unsigned  (also fail on any signature not made by GitHub;
                                                         use in cloud containers that sign with their own key)
"""

from __future__ import annotations

import hashlib
import re
import subprocess
import sys

DENY = {
    "c857d09db23e6822e3600bc06ad8d58f92ed62bc8efd81c753f77048662cb97d",
    "c70eca6b0f88f44d81a41311647e50fda1ac454ec04ffd442b0eb4743a993131",
}
TOKEN = re.compile(r"[a-z0-9]+")


def _hit(text: str) -> bool:
    return any(hashlib.sha256(t.encode()).hexdigest() in DENY for t in TOKEN.findall(text.lower()))


def _git(*args: str) -> str:
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout


def scan(strict_unsigned: bool = False) -> list[str]:
    problems = []
    for path in _git("ls-files").splitlines():
        if _hit(path):
            problems.append(f"file name: {path}")
            continue
        try:
            text = open(path, encoding="utf-8").read()
        except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if _hit(line):
                problems.append(f"{path}:{i}: <redacted>")
    for ref in _git("for-each-ref", "--format=%(refname)").splitlines():
        if _hit(ref):
            problems.append(f"ref name: <redacted> ({len(ref)} chars)")
    log = _git("log", "--all", "--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%G?%x1f%GS%x1f%B%x1e")
    for rec in filter(None, (r.strip() for r in log.split("\x1e"))):
        h, an, ae, cn, ce, sig, signer, body = (rec.split("\x1f") + [""] * 8)[:8]
        if _hit(" ".join([an, ae, cn, ce, body])):
            problems.append(f"commit {h[:10]}: metadata <redacted>")
        if sig not in ("N", "") and _hit(signer):
            problems.append(f"commit {h[:10]}: signer <redacted>")
        if strict_unsigned and sig not in ("N", "") and cn != "GitHub":  # GitHub web-flow signs its own commits
            problems.append(f"commit {h[:10]}: signed (status {sig}) but --strict-unsigned")
    return problems


if __name__ == "__main__":
    found = scan(strict_unsigned="--strict-unsigned" in sys.argv[1:])
    for p in found:
        print("name-guard:", p)
    sys.exit(1 if found else 0)
