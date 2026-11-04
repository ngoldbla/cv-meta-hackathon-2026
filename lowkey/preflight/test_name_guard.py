"""The provider may be named only in the allowlisted setup files (task 044).

The test never contains the name: it recovers the token from CREDITS.md by
its digest, then checks the guard flags it everywhere else.
"""

import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import name_guard  # noqa: E402


def _provider_token() -> str:
    for t in re.findall(r"[a-z0-9]+", (ROOT / "CREDITS.md").read_text().lower()):
        if hashlib.sha256(t.encode()).hexdigest() == name_guard.PROVIDER:
            return t
    raise AssertionError("provider token not found in CREDITS.md")


def test_allowlist_is_exactly_the_setup_files():
    assert name_guard.PROVIDER_ALLOWED_PATHS == {
        "CREDITS.md",
        "README.md",
        "lowkey/docs/roll-your-own.md",
        "lowkey/app/.env.example",
    }


def test_name_is_flagged_outside_the_allowlist():
    token = _provider_token()
    line = f"listings from {token} here"
    assert name_guard._hit(line)  # anywhere else: flagged
    assert not name_guard._hit(line, frozenset({name_guard.PROVIDER}))  # allowlisted files: allowed
