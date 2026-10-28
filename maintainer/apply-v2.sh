#!/usr/bin/env bash
# Maintainer only: install the v2.0 frozen files for the transit pivot, test them, commit them with the
# frozen-path guard deliberately unlocked for that one commit, record the change in the ledger, and push.
#
#   git checkout transit-pivot && git pull --ff-only && bash maintainer/apply-v2.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PY=.venv/bin/python
[ -x "$PY" ] || PY=python
[ "$(git rev-parse --abbrev-ref HEAD)" = transit-pivot ] || { echo "run this on the transit-pivot branch"; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "commit or stash your changes first"; exit 1; }
if [ -n "${CAGES_HOLDOUT_SALT:-}" ]; then echo "unset CAGES_HOLDOUT_SALT first (tests must not see it)"; exit 1; fi

cp maintainer/v2/cages/harness/evaluate.py cages/harness/evaluate.py
cp maintainer/v2/cages/data/instances.py cages/data/instances.py
"$PY" -m pytest -q

git config cages.unfreeze maintainer
trap 'git config --unset cages.unfreeze || true' EXIT
git add cages/harness/evaluate.py cages/data/instances.py
git commit -q -m "Evaluator v2.0 and instances for transit evacuation" -m "Assisted-by: agent"
git config --unset cages.unfreeze
trap - EXIT

"$PY" scripts/record_evaluator_update.py \
  --reason "v2.0: pivot from elevators to subway and bus evacuation (no holdout run had occurred)"
git add research/ledger.jsonl
git commit -q -m "Ledger: evaluator v2.0" -m "Assisted-by: agent"

git push origin transit-pivot
git push origin transit-pivot:gpu-phase  # fast-forward; the mailbox keeps using gpu-phase
echo "done: $(git rev-parse --short HEAD) on transit-pivot and gpu-phase"
