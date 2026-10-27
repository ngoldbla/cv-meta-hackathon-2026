---
name: search
description: Bounded improvement loop on the dev split only - generate CAGES data, train a decision model, evaluate, record. Use to develop candidates before a confirmatory test.
---
# Bounded search (dev only)

The budget is set by the caller: N iterations or $X of compute, enforced via `cloud/budget.py`. Each iteration:
1. Choose one change: data volume, failure regime, label horizon, backbone (scratch / Laya / decapitated Muse depth), LoRA rank, or confidence threshold.
2. Run `generate_cages` (if the data changed), then `train`, then `eval_dev` against the strongest baseline.
3. Log the change, the metrics and the compute spent to `research/journal.md`.

Rules:
- Never evaluate on the holdout here.
- Never edit the frozen paths.
- Keep every negative result.
- Stop when the budget is spent or the dev gain has plateaued for 3 iterations.
