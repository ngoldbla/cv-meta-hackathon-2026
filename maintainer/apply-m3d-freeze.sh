#!/usr/bin/env bash
# Maintainer only: the M3 freeze of the EMS judge. Adds judges/ems/FROZEN and the updated layout test, runs
# every check plus the compute-gate bench, commits with the guard unlocked for that one commit, then records an
# evaluator_update (all frozen SHA-256s) and a dataset_release (calibration bundle, manifests, day tables).
#
#   bash maintainer/apply-m3d-freeze.sh            # on main, clean tree
#   bash maintainer/apply-m3d-freeze.sh --no-push  # dry run in a throwaway clone
set -euo pipefail
cd "$(dirname "$0")/.."
PUSH=1; [ "${1:-}" = "--no-push" ] && PUSH=0
PY="$PWD/.venv/bin/python"; [ -x "$PY" ] || PY="$(command -v python3)"
RUFF=.venv/bin/ruff; [ -x "$RUFF" ] || RUFF="$PY -m ruff"
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "run this on main"; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "commit or stash your changes first"; exit 1; }
[ -z "${CAGES_HOLDOUT_SALT:-}" ] || { echo "unset CAGES_HOLDOUT_SALT first"; exit 1; }
[ ! -e judges/ems/FROZEN ] || { echo "already frozen (judges/ems/FROZEN exists)"; exit 1; }
[ -f judges/ems/ems/scenarios/core.py ] || { echo "task 012 (scenario mechanics split) is not applied"; exit 1; }

cp maintainer/m3d/FROZEN judges/ems/FROZEN
cp maintainer/m3d/test_judges_layout.py tests/test_judges_layout.py
"$PY" -m pytest -q
"$PY" scripts/name_guard.py
$RUFF check -q .
"$PY" -c "from loopkit.ledger import Ledger; assert Ledger().verify()"
out=$(cd judges/ems && rm -rf runs/ems-ref && "$PY" experiments/ar/ems_blue_bench.py --n 200 | tail -2)
echo "$out" | grep -q '"primary": 11247.14150209779' || { echo "bench drifted: $out"; exit 1; }
echo "$out" | tail -1

git config loopkit.unfreeze maintainer
trap 'git config --unset loopkit.unfreeze || true' EXIT
git add judges/ems/FROZEN tests/test_judges_layout.py
git commit -q -m "Freeze the EMS judge (M3)" -m "Assisted-by: agent"
git config --unset loopkit.unfreeze
trap - EXIT

"$PY" scripts/record_freeze.py --scope ems \
  --reason "M3 freeze of the EMS judge: simulator, policies b0/b1/oracle, evaluator ems-1.0, lever parameters, scenario mechanics and bounds, anchors (7/10, frozen 2026-11-01), calibration bundle and manifests; reviewed by the reviewer and authorized by Dylan 2026-11-01"
"$PY" maintainer/m3d/record_dataset.py
"$PY" -c "from loopkit.ledger import Ledger; assert Ledger().verify()"
git add research/ledger.jsonl
git commit -q -m "Ledger: M3 EMS freeze and dataset release" -m "Assisted-by: agent"
if [ "$PUSH" = 1 ]; then git pull --no-rebase -q && git push origin main; fi
echo "done: $(git rev-parse --short HEAD)"
