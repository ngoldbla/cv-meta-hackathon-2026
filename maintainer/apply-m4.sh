#!/usr/bin/env bash
# Maintainer only: the M4 seal. Snapshots the red run's final generator (task 014), builds the stress pool from it
# over the 2016 dates (no call data read), installs evaluator ems-1.1 (eval_holdout runs all pools of a
# pre-registration at once), freezes the new files, runs every check plus the dev bench, commits with the guard
# unlocked for that one commit, then records an evaluator_update and a dataset_release for the stress pool.
# The pre-registrations are registered separately, after Dylan approves their text.
#
#   bash maintainer/apply-m4.sh            # on main, clean tree, after task 014
#   bash maintainer/apply-m4.sh --no-push  # dry run in a throwaway clone
set -euo pipefail
cd "$(dirname "$0")/.."
PUSH=1; [ "${1:-}" = "--no-push" ] && PUSH=0
PY="$PWD/.venv/bin/python"; [ -x "$PY" ] || PY="$(command -v python3)"
RUFF=.venv/bin/ruff; [ -x "$RUFF" ] || RUFF="$PY -m ruff"
RED=${RED_REF:-origin/ar/red/ems-stress}
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "run this on main"; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "commit or stash your changes first"; exit 1; }
[ -z "${CAGES_HOLDOUT_SALT:-}" ] || { echo "unset CAGES_HOLDOUT_SALT first"; exit 1; }
[ ! -e judges/ems/data/manifests/stress-pool.json ] || { echo "already applied (stress pool exists)"; exit 1; }
grep -q "^status: done" ops/tasks/014-ems-red-stress.md || { echo "task 014 (red run) is not done"; exit 1; }
red_commit=$(git rev-parse "$RED")

git show "$RED:judges/ems/experiments/ar/ems_red_sampler.py" > judges/ems/experiments/ar/ems_red_generator_m4.py
cp maintainer/m4/evaluate.py judges/ems/ems/evaluate.py
cp maintainer/m4/test_evaluate.py judges/ems/tests/test_evaluate.py
cp maintainer/m4/test_judges_layout.py tests/test_judges_layout.py
(cd judges/ems && "$PY" scripts/stress_pool.py --generator experiments/ar/ems_red_generator_m4.py)
cat maintainer/m4/FROZEN.add >> judges/ems/FROZEN
"$PY" -m pytest -q
"$PY" scripts/name_guard.py
$RUFF check -q .
"$PY" -c "from loopkit.ledger import Ledger; assert Ledger().verify()"
out=$(cd judges/ems && rm -rf runs/ems-ref && "$PY" experiments/ar/ems_blue_bench.py --n 200 | tail -2)
echo "$out" | grep -q '"primary": 11247.14150209779' || { echo "bench drifted: $out"; exit 1; }

git config loopkit.unfreeze maintainer
trap 'git config --unset loopkit.unfreeze || true' EXIT
git add judges/ems/FROZEN judges/ems/ems/evaluate.py judges/ems/tests/test_evaluate.py \
  judges/ems/experiments/ar/ems_red_generator_m4.py judges/ems/data/manifests/stress-pool.json \
  tests/test_judges_layout.py
git commit -q -m "M4: evaluator ems-1.1, sealed stress pool, freeze the red bench and sampler" -m "Assisted-by: agent"
git config --unset loopkit.unfreeze
trap - EXIT

"$PY" scripts/record_freeze.py --scope ems \
  --reason "M4: evaluator ems-1.1 (eval_holdout runs all pools of a pre-registration at once, Holm across them; dev scoring unchanged); froze the nominal sampler, red bench, stress-pool builder, the red run's generator ($red_commit) and the stress pool; authorized by Dylan 2026-11-01"
"$PY" maintainer/m4/record_stress.py "$red_commit"
"$PY" -c "from loopkit.ledger import Ledger; assert Ledger().verify()"
git add research/ledger.jsonl
git commit -q -m "Ledger: M4 evaluator ems-1.1 and the sealed stress pool" -m "Assisted-by: agent"
if [ "$PUSH" = 1 ]; then git pull --no-rebase -q && git push origin main; fi
echo "done: $(git rev-parse --short HEAD)"
