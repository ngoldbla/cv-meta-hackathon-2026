"""Frozen-path guard (wrapper; the logic is loopkit/guard.py, and both files are frozen).

    python scripts/guard_paths.py --staged          # git pre-commit
    python scripts/guard_paths.py path [path ...]   # check paths an agent wants to edit
    echo '{"tool_input": {"file_path": "..."}}' | python scripts/guard_paths.py --hook   # exit 2 = block
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from loopkit.guard import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
