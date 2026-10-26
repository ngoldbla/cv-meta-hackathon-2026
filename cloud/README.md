# Cloud and edge

## Budget (~$200 of CUDA, any provider)

| Item | Cap | Command |
|---|---|---|
| CAGES v0 labels (2,000 instances x 30 states) on a 64-vCPU spot box | $20 | `cloud/jobs.sh` step 1 |
| Decapitate Muse Glimmer 30B to 8 and 12 layers (streams safetensors; no GPU) | -- | step 2 |
| 4 decision-model runs on 1x H100 (depth L8/L12 x LoRA r16/r64) | 4 x $22 | step 3 |
| Laya-421M and 20M from-scratch controls | $8 + $5 | step 3 |
| Holdout evaluation (CPU) | ~$15 | `eval_holdout` via MCP |
| Reserve | ~$60 | |

`cloud/budget.py` enforces each cap:
- it refuses a job whose cap would push total spend over $200;
- it kills a job when its cap runs out;
- it logs spend to `runs/spend.jsonl`.

Set `PRICE_CPU` and `PRICE_GPU` to your provider's hourly rates before running `cloud/jobs.sh`.

Size note: with the LM head, vision tower and token embeddings dropped, Muse Glimmer's dense layers are about 0.46B parameters each. That gives roughly:

| Kept layers | Parameters | Size at 4-bit |
|---|---|---|
| 8 | ≈ 3.7B | ≈ 1.9 GB |
| 12 | ≈ 5.5B | ≈ 2.8 GB |

## Edge (RTX 5060 Ti 16 GB)

```bash
python scripts/edge_bench.py --model runs/decision-glimmer-L8-r16 --device cuda --quant nf4
```

The benchmark reports p50/p99 latency per decision, against a target of p99 ≤ 50 ms, plus peak VRAM. The runtime stack is:
- Timestral-28M (it runs on CPU);
- the 4-bit decision trunk;
- the ESA fallback (pure Python).

Untested in the build container (no GPU); results must be measured on the target card.

## Timestral fine-tuning

The Timestral repository ships inference only. To fine-tune on CAGES demand series, adapt its model module with a pinball (quantile) loss on per-floor call counts, using the event schedule as known covariates. Until that has been done and validated, zero-shot Timestral plus the schedule prior is the forecaster to evaluate.
