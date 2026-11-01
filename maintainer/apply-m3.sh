#!/usr/bin/env bash
# Maintainer only: the M3a restructure. Creates the judges/ layout, swaps in the loopkit-based guard and the
# CAGES ledger re-export, adds judges/cages/FROZEN, rewrites paths, runs every check, commits with the guard
# unlocked for that one commit, records the frozen SHA-256s in the ledger, and pushes.
#
#   bash maintainer/apply-m3.sh            # on main, clean tree
#   bash maintainer/apply-m3.sh --no-push  # dry run in a throwaway clone
set -euo pipefail
cd "$(dirname "$0")/.."
PUSH=1; [ "${1:-}" = "--no-push" ] && PUSH=0
PY=.venv/bin/python; [ -x "$PY" ] || PY=python
RUFF=.venv/bin/ruff; [ -x "$RUFF" ] || RUFF="$PY -m ruff"
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "run this on main"; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "commit or stash your changes first"; exit 1; }
[ -z "${CAGES_HOLDOUT_SALT:-}" ] || { echo "unset CAGES_HOLDOUT_SALT first (tests must not see it)"; exit 1; }
[ ! -e judges/cages ] || { echo "already applied (judges/cages exists)"; exit 1; }

mkdir -p judges/cages/scripts judges/cages/tests
git mv cages judges/cages/cages
for d in anchors datasets experiments mcp; do git mv "$d" "judges/cages/$d"; done
for f in confirm edge_bench extract_laya_encoder record_evaluator_update; do
  git mv "scripts/$f.py" "judges/cages/scripts/$f.py"
done
for t in test_anchors test_ar_bench test_crowd test_harness test_labels test_model test_sim; do
  git mv "tests/$t.py" "judges/cages/tests/$t.py"
done
cp maintainer/m3/guard_paths.py scripts/guard_paths.py
cp maintainer/m3/cages_ledger.py judges/cages/cages/harness/ledger.py
cp maintainer/m3/FROZEN judges/cages/FROZEN
cp maintainer/m3/test_judges_layout.py tests/test_judges_layout.py
"$PY" maintainer/m3/rewrite_paths.py
[ -e .venv ] && [ ! -e judges/cages/.venv ] && ln -s ../../.venv judges/cages/.venv
"$PY" -m pip install -e . -q --no-deps
"$PY" -m pytest -q
"$PY" scripts/name_guard.py
$RUFF check -q .
"$PY" -c "from loopkit.ledger import Ledger; assert Ledger().verify()"

git config loopkit.unfreeze maintainer
trap 'git config --unset loopkit.unfreeze || true' EXIT
git add -A judges scripts tests loopkit pyproject.toml .github AGENTS.md README.md docs skills cloud
git commit -q -m "Restructure: loopkit harness; CAGES moves to judges/cages" -m "Assisted-by: agent"
git config --unset loopkit.unfreeze
trap - EXIT

"$PY" scripts/record_freeze.py --scope program \
  --reason "M3a restructure: loopkit harness (ledger found by AGENTS.md marker, stats, per-judge FROZEN guard); CAGES moved to judges/cages (evaluator and instances byte-identical); ledger paths in earlier entries are relative to judges/cages"
git add research/ledger.jsonl
git commit -q -m "Ledger: M3a freeze" -m "Assisted-by: agent"
if [ "$PUSH" = 1 ]; then git pull --no-rebase -q && git push origin main; fi
echo "done: $(git rev-parse --short HEAD)"
