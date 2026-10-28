# Cloud and edge

## Budget ($100 of cloud credit, held in reserve)

All GPU work runs on the local RTX 5060 Ti (`docs/runbook-gpu.md`). The credit is spent only when a local limit
blocks a result, for example:
- bf16 LoRA on trunks deeper than 12 layers, which does not fit in 16 GB;
- a multi-seed or depth/rank sweep of Glimmer runs that would take too long one at a time on one card.

If any E3 arm is trained in the cloud, retrain every E3 arm there with identical settings: E3 requires the same
training budget for all backbones. Holdout runs and the E3 latency gate stay on the local machine, because the
salt never leaves it and the gate is defined on the RTX 5060 Ti.

Any cloud job runs through `cloud/budget.py`, which enforces caps:
- it refuses a job whose cap would push total spend over $100;
- it kills a job when its cap runs out;
- it logs spend to `runs/spend.jsonl`.

```bash
python cloud/budget.py run --name glimmer-L8-s1 --price <provider $/h> --cap 10 -- python -m cages.model.train ...
```

Size note: with the LM head, vision tower and token embeddings dropped, Muse Glimmer's dense layers are about 0.46B parameters each. That gives roughly:

| Kept layers | Parameters | Size at 4-bit |
|---|---|---|
| 8 | ≈ 3.7B | ≈ 1.9 GB |
| 12 | ≈ 5.5B | ≈ 2.8 GB |

## Edge (RTX 5060 Ti 16 GB)

```bash
python scripts/edge_bench.py --model runs/evac-glimmer-L8-r16 --data datasets/cages-v0 --device cuda
```

The benchmark reports p50/p99 latency per decision, against a target of p99 ≤ 50 ms, plus peak VRAM. The runtime stack is:
- Timestral-28M (it runs on CPU);
- the 4-bit decision trunk;
- the rolling-horizon fallback (pure Python).

Untested in the build container (no GPU); results must be measured on the target card.

## Timestral fine-tuning

The Timestral repository ships inference only. To fine-tune on CAGES demand series, adapt its model module with a pinball (quantile) loss on per-station alert and entry counts, using the emergency declaration as a known covariate. Until that has been done and validated, zero-shot Timestral plus the schedule prior is the forecaster to evaluate.
