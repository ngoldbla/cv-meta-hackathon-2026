# Label-horizon choice for CAGES v0 (dev only)

Rule: ledger seq 8 (`protocol_note`, hash `24a3d8c7…`): the horizon whose
mixture at threshold 0.0 has the lower mean dev P95 over 40 dev instances is
used for every E3 arm. Probes: `--backbone scratch --d-model 256 --n-layers 4
--epochs 20 --batch 64 --lr 3e-4 --seed 0`, one per horizon dataset.

## Probe training (offline, `runs/<run>/metrics.json`)

| probe | data | dev top-1 | dev regret | ECE | minutes |
|---|---|---|---|---|---|
| `evac-probe-h900` | `datasets/cages-v0` | 0.364 | 0.0047 | 0.062 | 1.45 |
| `evac-probe-h2700` | `datasets/cages-v0-h2700` | 0.449 | 0.0098 | 0.049 | 1.46 |

Sources: `experiments/results/evac-probe-h900-metrics.json`,
`experiments/results/evac-probe-h2700-metrics.json` (copies of the ignored
`runs/<run>/metrics.json`; params 3,409,154 each, device cuda, quant none).

## Closed loop, 40 dev instances

Baselines (`experiments/results/dev-baselines/summary.json`): express_rule P95
2622.63, staging P95 2220.78 — identical to the v0-mini replication in
`research/results.md`.

| mixture | mean dev P95 | vs staging (paired) | source |
|---|---|---|---|
| h900 @0.0 | 2142.69 | −2.11% [−4.26, +0.08], p = 2.8e-04 | `experiments/results/dev-evac-probe-h900/summary.json` |
| h900 @0.2 | 2167.80 | −1.95% [−3.66, −0.26], p = 2.0e-03 | same |
| h2700 @0.0 | 2136.97 | −3.18% [−4.83, −1.54], p = 2.6e-04 | `experiments/results/dev-evac-probe-h2700/summary.json` |
| h2700 @0.2 | 2135.92 | −3.05% [−4.67, −1.43], p = 2.6e-04 | same |

Evaluator v2.0, SHA-256 `97e924f8…` (in both `summary.json` files).

## Decision (mechanical application of the seq-8 rule)

2136.97 < 2142.69, so the **2700 s horizon** wins by 5.72 s (0.27%).
**All E3 arms train on `datasets/cages-v0-h2700`.**

Note: the margin is small and the two @0.0 CIs overlap substantially; the rule
is mechanical and was fixed before any result existed, so h2700 stands.
