# Maintainer actions (repository author only)

Agents cannot change frozen paths. Changes to them are prepared here, reviewed, and applied by the maintainer.

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
