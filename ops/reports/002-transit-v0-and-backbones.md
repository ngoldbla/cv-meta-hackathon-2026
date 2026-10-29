# Report 002: Scale CAGES (evacuation) to v0, pick the label horizon, train the E3 backbones, dev selection and edge latency
Status: in_progress
Branch head at start: 0d0ccd1db4a3d3f087fecd5cd757b6da9a9d1c67  ·  at finish: TBD

## Summary
Prerequisites pass; Part A done. `scripts/extract_laya_encoder.py` rebuilds `runs/laya-encoder` byte-identically (170 tensors, 394,781,696 params, sha256 `0c31065b…`) from `convaiinnovations/laya` at revision `7b928d82…`. Parts B–D done (ledger seqs 8–10; horizon chosen: h2700). Parts E–F next.

## Work done
- Claimed task 002: set `status: in_progress`, created this report.
- Prerequisite: ledger seq 7 is `evaluator_update` with `eval_version 2.0`; `pytest -q` → 43 passed, 1 skipped. Read README, results, journal 2026-10-28 entry, runbook-gpu, E3 draft.
- Part A: wrote `scripts/extract_laya_encoder.py` (pinned revision `7b928d828b7b0e022f929d9bd2e44165aa270148`, verified as current Hub main); rebuilt into `/tmp/laya-rebuild`; compared against `runs/laya-encoder`: same names/shapes/dtypes/values, identical config, identical file sha256. No differences.
- Part B: `ledger_commit(kind="protocol_note")` → seq 8 (`24a3d8c7…`), fixing the label-horizon rule, the six E3 arms, the dev-selection rule and the edge gate before any Part C–F result exists. `Ledger().verify()` → True.
- Part C: generated `datasets/cages-v0` (h900: 23,554/2,360 states, 13 MB) and `datasets/cages-v0-h2700` (h2700: 23,554/2,360 states, 13 MB) on 24 workers (~1h50 + ~3h05 wall). Train and dev `specs.jsonl` are byte-identical across horizons (`cmp`). Cards: no-action-best 52%→23% (train) and gaps 5%→10% at the longer horizon. `dataset_release` entries seq 9 (`156ee59d…`, h900) and seq 10 (`b70735e4…`, h2700); chain verifies. Both datasets committed whole (each < 50 MB).

- Part D: trained `evac-probe-h900` (dev top-1 0.364) and `evac-probe-h2700` (dev top-1 0.449), 20 epochs each, ~1.5 min on CUDA, no OOM. Baselines on CPU reproduce `research/results.md` exactly (staging P95 2220.78). Closed loop @0.0: h900 2142.69 vs staging −2.11%; h2700 2136.97 vs staging −3.18%. Rule → **h2700** (margin 5.72 s). Decision in `experiments/results/label-horizon-v0.md`. Probe evals ran on GPU per runbook §4 (task Part D silent on device).
- Part E (1/6): `evac-glimmer-L8-r16` — 6 epochs, batch 16, 52.1 min on CUDA, no OOM. Dev top-1 0.502, regret 0.0130, ECE 0.107. Metrics in `experiments/results/evac-glimmer-L8-r16-metrics.json`.
- Part E (2/6): `evac-glimmer-L12-q16` — 6 epochs, batch 16, nf4, 104.0 min on CUDA, no OOM. Dev top-1 0.420, regret 0.0124, ECE 0.052. Metrics in `experiments/results/evac-glimmer-L12-q16-metrics.json`.
- Part E (3/6): `evac-laya-r16` — 6 epochs, batch 16, 16.9 min on CUDA, no OOM. Dev top-1 0.455, regret 0.0084, ECE 0.068. Metrics in `experiments/results/evac-laya-r16-metrics.json`.
- Part E (4/6): `evac-scratch-20m` (s0) — 6 epochs, batch 16, 2.8 min on CUDA, no OOM. Dev top-1 0.449, regret 0.0142, ECE 0.074. Metrics in `experiments/results/evac-scratch-20m-metrics.json`.
- Part E (5/6): `evac-scratch-20m-s1` — same config, seed 1, 2.8 min on CUDA, no OOM. Dev top-1 0.505, regret 0.0147, ECE 0.130. Metrics in `experiments/results/evac-scratch-20m-s1-metrics.json`.
- Part E (6/6): `evac-scratch-20m-s2` — same config, seed 2, 2.8 min on CUDA, no OOM. Dev top-1 0.479, regret 0.0112, ECE 0.112. Metrics in `experiments/results/evac-scratch-20m-s2-metrics.json`. Part E complete: all six arms at batch 16, zero OOM retries.
- Part F evals (CUDA, `--thresholds 0.0,0.2,0.35`, `--baselines express_rule,staging`):
  - `evac-scratch-20m`: @0.0 2141, @0.2 2138, @0.35 2202 (`experiments/results/dev-evac-scratch-20m/`).
  - `evac-scratch-20m-s1`: @0.0 2160, @0.2 2161, @0.35 2190 (`experiments/results/dev-evac-scratch-20m-s1/`).
  - `evac-scratch-20m-s2`: @0.0 2145, @0.2 2145, @0.35 2189 (`experiments/results/dev-evac-scratch-20m-s2/`).
  - `evac-laya-r16`: @0.0 2119, @0.2 2127, @0.35 2177 (`experiments/results/dev-evac-laya-r16/`).

## Results
| probe mixture @0.0 | mean dev P95 | vs staging | file |
|---|---|---|---|
| h900 | 2142.69 | −2.11% [−4.26, +0.08] | `experiments/results/dev-evac-probe-h900/summary.json` |
| h2700 | 2136.97 | −3.18% [−4.83, −1.54] | `experiments/results/dev-evac-probe-h2700/summary.json` |

Decision: all E3 arms train on `datasets/cages-v0-h2700` (`experiments/results/label-horizon-v0.md`).

## Deviations
- Part D: copied probe `metrics.json` files to `experiments/results/evac-probe-<h>-metrics.json` (task only requires this for E3 arms in Part E; done so the decision file cites committed files, since `runs/` is git-ignored). Probe closed-loop evals ran on CUDA per runbook §4.

## Blocked / questions
None.
