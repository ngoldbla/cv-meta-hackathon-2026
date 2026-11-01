"""Exact-match path rewrites after the CAGES move (run by maintainer/apply-m3.sh from the repo root)."""

from __future__ import annotations

import sys
from pathlib import Path

EDITS: list[tuple[str, str, str]] = [
    ("pyproject.toml", '[tool.setuptools.packages.find]\ninclude = ["cages*", "loopkit*"]',
     '[tool.setuptools.packages.find]\nwhere = [".", "judges/cages"]\ninclude = ["cages*", "loopkit*"]'),
    ("pyproject.toml", '[tool.pytest.ini_options]\ntestpaths = ["tests"]',
     '[tool.pytest.ini_options]\ntestpaths = ["tests", "judges/cages/tests"]\naddopts = "--import-mode=importlib"'),
    ("pyproject.toml", "[tool.ruff]\nline-length = 110", '[tool.ruff]\nline-length = 110\nsrc = [".", "judges/cages"]'),
    (".github/workflows/ci.yml", "from cages.harness.ledger import Ledger", "from loopkit.ledger import Ledger"),
    ("judges/cages/tests/test_harness.py", "ROOT = Path(__file__).resolve().parents[1]\n",
     "ROOT = Path(__file__).resolve().parents[1]\nREPO = ROOT.parents[1]\n"),
    ("judges/cages/tests/test_harness.py", '"scripts/guard_paths.py", "cages/harness/evaluate.py"], cwd=ROOT,',
     '"scripts/guard_paths.py", "judges/cages/cages/harness/evaluate.py"], cwd=REPO,'),
    ("judges/cages/tests/test_harness.py", '"scripts/guard_paths.py", "--hook"], cwd=ROOT,',
     '"scripts/guard_paths.py", "--hook"], cwd=REPO,'),
    ("judges/cages/tests/test_harness.py", '"scripts/guard_paths.py", "cages/sim/core.py"], cwd=ROOT,',
     '"scripts/guard_paths.py", "judges/cages/cages/sim/core.py"], cwd=REPO,'),
    ("judges/cages/tests/test_harness.py", '"scripts/name_guard.py"], cwd=ROOT,', '"scripts/name_guard.py"], cwd=REPO,'),
    ("judges/cages/scripts/confirm.py", "from pathlib import Path\n",
     "from pathlib import Path\n\nfrom loopkit.ledger import repo_root\n"),
    ("judges/cages/scripts/confirm.py", 'out = Path("research/holdout") / f"{a.prereg}.json"',
     'out = repo_root() / "research" / "holdout" / f"{a.prereg}.json"'),
    ("AGENTS.md",
     "- **Never edit the frozen paths:** `cages/harness/evaluate.py`, `cages/harness/ledger.py`, "
     "`cages/data/instances.py`, `scripts/guard_paths.py`.",
     "- **Never edit the frozen paths:** every path listed in a judge's `judges/<judge>/FROZEN` manifest (CAGES: "
     "`cages/harness/evaluate.py`, `cages/harness/ledger.py`, `cages/data/instances.py`), the manifests "
     "themselves, `loopkit/` and `scripts/guard_paths.py`. A maintainer unlocks one commit with "
     "`git config loopkit.unfreeze maintainer`."),
    ("AGENTS.md",
     "CAGES is judge #1 and lives at the repository root until M3. The rules below that name CAGES paths apply to it.",
     "CAGES is judge #1 in `judges/cages/`. Run its commands from that directory, where its relative paths "
     "(`datasets/`, `runs/`, `experiments/results/`) resolve, and read the CAGES paths below relative to it."),
    ("README.md", "repository root (`cages/`); moves to `judges/cages/` in M3", "`judges/cages/`"),
    ("docs/runbook-loop.md", "2. Register the MCP server from `mcp/cages.mcp.json`:",
     "2. Register the MCP server from `judges/cages/mcp/cages.mcp.json`, with `judges/cages/` as its working "
     "directory:"),
    ("docs/runbook-gpu.md", "Never set `CAGES_HOLDOUT_SALT` in this session.",
     "Run `bash scripts/setup_gpu_host.sh` from the repository root. Run every other command from `judges/cages/` "
     "(link the environment once: `ln -s ../../.venv judges/cages/.venv`). Never set `CAGES_HOLDOUT_SALT` in this "
     "session."),
    ("docs/cages.md", "## How the code runs the loop\n",
     "## How the code runs the loop\n\nPaths below are relative to `judges/cages/`.\n"),
    ("docs/cages.md",
     "pytest -q                                          # line physics, crowd, labels, models, harness\n",
     "pytest -q                                          # line physics, crowd, labels, models, harness\n"
     "cd judges/cages && ln -s ../../.venv .venv         # CAGES commands run from the judge directory\n"),
    ("cloud/README.md", "# Cloud and edge\n",
     "# Cloud and edge\n\nRun the CAGES commands below from `judges/cages/` (call this tool as `../../cloud/budget.py`).\n"),
    ("skills/review/SKILL.md", "  - Do all anchors in `anchors/` still pass?",
     "  - Do all anchors in the judge's `anchors/` (CAGES: `judges/cages/anchors/`) still pass?"),
]


def main() -> int:
    for path, old, new in EDITS:
        p = Path(path)
        text = p.read_text()
        if text.count(old) != 1:
            print(f"rewrite failed: {path}: expected 1 match, found {text.count(old)}: {old[:60]!r}", file=sys.stderr)
            return 1
        p.write_text(text.replace(old, new))
    print(f"{len(EDITS)} rewrites applied")
    return 0


if __name__ == "__main__":
    sys.exit(main())
