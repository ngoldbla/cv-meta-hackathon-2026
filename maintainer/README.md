# Maintainer actions (repository author only)

Agents cannot change frozen paths. Changes to them are prepared here, reviewed, and applied by the maintainer.

## M3 freeze: the EMS judge (`maintainer/m3d/`, `apply-m3d-freeze.sh`)
- **What:** adds `judges/ems/FROZEN` (35 paths: simulator, policies b0/b1/oracle, evaluator, lever parameters, scenario mechanics and bounds, anchors, calibration bundle, data manifests) and updates `tests/test_judges_layout.py` to check it. The red loop's `ems/scenarios/sampler.py` and the blue loop's `experiments/ar/ems_candidate.py` stay editable.
- **Ledger:** an `evaluator_update` (scope `ems`, every frozen SHA-256), then a `dataset_release` (`maintainer/m3d/record_dataset.py`: calibration and manifest hashes, plus one digest over the 1,095 git-ignored day tables).
- **Needs:** task 012 applied (`ems/scenarios/core.py`), and the day-table cache built. The script reruns the compute-gate bench and refuses to commit if the result drifts from task 011.
- **Run:** `git checkout main && git pull --ff-only && bash maintainer/apply-m3d-freeze.sh`. Dry run: `--no-push` in a throwaway clone.

## M3a: judges/ layout and the loopkit harness (`maintainer/m3/`, `apply-m3.sh`)
- **What:** the shared harness moves to `loopkit/` (ledger, statistics, guard), and CAGES moves to `judges/cages/`. The guard reads one `FROZEN` manifest per judge.
- **What changes in frozen files:** `scripts/guard_paths.py` becomes a wrapper around `loopkit.guard`, and CAGES's `ledger.py` becomes a re-export of `loopkit.ledger`. The CAGES evaluator and instance generator move byte for byte.
- **Tested:** in a throwaway clone with `bash maintainer/apply-m3.sh --no-push` (see `docs/superpowers/plans/2026-11-01-m3a-harness-restructure.md`, Task 5).
- **Run:** `git checkout main && git pull --ff-only && bash maintainer/apply-m3.sh`. The unlock key is now `loopkit.unfreeze`.
- **Historical:** the v2 scripts below (`apply-v2.sh`, `overlay.sh`) assume the pre-M3 layout and no longer run.
## v2.0: the transit pivot (`maintainer/v2/`, `apply-v2.sh`)
- **Why:** the project pivots from elevators to subway and bus evacuation. The frozen evaluator (`cages/harness/evaluate.py`) and instance generator (`cages/data/instances.py`) must follow:
  - new controller names;
  - transit instances drawn from the 7 line;
  - `peak_density` as the third primary metric.

  The ledger, the one-shot holdout rule and the statistics are unchanged.
- **Safe to apply now:** no holdout run exists, and H1–H3 are withdrawn by a `protocol_note` ledger entry before any holdout.
- **Tested:** with `maintainer/overlay.sh`, which copies the tree to a throwaway directory, overlays `maintainer/v2/` and runs `pytest`. Everything passes there except the name guard, which needs `.git`; it passes in the real tree.

```bash
git checkout transit-pivot && git pull --ff-only
bash maintainer/apply-v2.sh
```

The script does the following:
1. Copies the two files into place and runs `pytest`.
2. Commits them with the guard unlocked for that one commit.
3. Records an `evaluator_update` ledger entry with both SHA-256s.
4. Pushes `transit-pivot` and fast-forwards `gpu-phase`.

It refuses to run if `CAGES_HOLDOUT_SALT` is set.

## History
- **v1.1** (applied in `bf9bfeb`): added the learned-forecaster mixture arm and GPU evaluation for the elevator phase.
