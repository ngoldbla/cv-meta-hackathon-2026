# Maintainer actions (repository author only)

Agents cannot change frozen paths. Changes to them are prepared here as reviewed patches, and the
maintainer applies them.

## Evaluator v1.1 (`evaluator-v1.1.patch`)
- **Why:**
  - It adds `mixture+timestral:<ckpt>@<thr>`, so that the mixture and its comparison arm (`esa+timestral`) use the same learned forecaster.
  - It adds GPU evaluation (`CAGES_EVAL_DEVICE=cuda`, spawned workers).
- **Safe to apply now:** no holdout run exists.
- **Tested:** in a throwaway worktree, harness tests pass and the mixture loads.

```bash
git apply maintainer/evaluator-v1.1.patch
git config cages.unfreeze maintainer          # lets the frozen-path pre-commit hook pass for this commit
pytest -q
git add cages/harness/evaluate.py && git commit -m "Evaluator v1.1: learned-forecaster arm and GPU evaluation"
git config --unset cages.unfreeze
python scripts/record_evaluator_update.py --reason "v1.1: mixture+timestral arm, GPU evaluation"
git add research/ledger.jsonl && git commit -m "Ledger: evaluator v1.1" && git push
```

If the learned forecaster becomes the H2 comparison, pre-register **H2b** (`mixture+timestral` vs
`esa+timestral`) before any holdout run. H2 as written (schedule-prior arm) stays valid; it is not edited.
