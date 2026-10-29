# Report 002: Scale CAGES (evacuation) to v0, pick the label horizon, train the E3 backbones, dev selection and edge latency
Status: in_progress
Branch head at start: 0d0ccd1db4a3d3f087fecd5cd757b6da9a9d1c67  ·  at finish: TBD

## Summary
Task complete. CAGES v0 generated at both horizons (23,554/2,360 states each);
h2700 chosen by the pre-registered rule (2136.97 vs 2142.69). All six E3 arms
trained at batch 16 with no OOM. Dev selection: Laya @0.0 wins overall
(2118.72, −3.45% vs staging), beating both Glimmer trunks and scratch; all six
pass the 50 ms edge gate. Rule picks (L8 @0.2, L12 @0.0, Laya @0.0, scratch s0
@0.2, E2 = Laya @0.0) need approval; no `model_choice` written, no holdout run.

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
  - `evac-glimmer-L8-r16`: @0.0 2152, @0.2 2146, @0.35 2192 (`experiments/results/dev-evac-glimmer-L8-r16/`).
  - `evac-glimmer-L12-q16`: @0.0 2148, @0.2 2155, @0.35 2176 (`experiments/results/dev-evac-glimmer-L12-q16/`).
- Part F step 2: wrote `experiments/results/dev-selection.md`. Mechanical rule picks: L8 @0.2 (2145.73), L12 @0.0 (2148.03), Laya @0.0 (2118.72), scratch s0 @0.2 (2137.86). E2 pending edge gate.
- Part F step 3: edge bench (CUDA, trained precision) → `experiments/results/edge-<run>.json`. p99 ms: L8 44.78, L12 48.90, laya 29.45, s0 3.08, s1 2.62, s2 2.78 — all pass the 50 ms gate. E2 checkpoint: **laya-r16 @0.0 (2118.72), needs approval**. No `model_choice` written; no holdout run; drafts untouched.

## Results
| probe mixture @0.0 | mean dev P95 | vs staging | file |
|---|---|---|---|
| h900 | 2142.69 | −2.11% [−4.26, +0.08] | `experiments/results/dev-evac-probe-h900/summary.json` |
| h2700 | 2136.97 | −3.18% [−4.83, −1.54] | `experiments/results/dev-evac-probe-h2700/summary.json` |

Decision: all E3 arms train on `datasets/cages-v0-h2700` (`experiments/results/label-horizon-v0.md`).

### Every run (training → dev → edge)

Training metrics from `experiments/results/evac-<arm>-metrics.json`; dev P95
from `experiments/results/dev-<run>/summary.json`; edge p99 from
`experiments/results/edge-<run>.json`.

| run | dev top-1 / regret / ECE | min | best dev P95 @thr (vs staging) | fallback | edge p99 |
|---|---|---|---|---|---|
| evac-glimmer-L8-r16 | 0.502 / 0.0130 / 0.107 | 52.1 | 2145.73 @0.2 (−3.04%) | 0.102 | 44.78 ms ✓ |
| evac-glimmer-L12-q16 | 0.420 / 0.0124 / 0.052 | 104.0 | 2148.03 @0.0 (−2.47%) | 0.000 | 48.90 ms ✓ |
| evac-laya-r16 | 0.455 / 0.0084 / 0.068 | 16.9 | 2118.72 @0.0 (−3.45%) | 0.000 | 29.45 ms ✓ |
| evac-scratch-20m | 0.449 / 0.0142 / 0.074 | 2.8 | 2137.86 @0.2 (−2.56%) | 0.068 | 3.08 ms ✓ |
| evac-scratch-20m-s1 | 0.505 / 0.0147 / 0.130 | 2.8 | 2159.82 @0.0 (−1.82%) | 0.000 | 2.62 ms ✓ |
| evac-scratch-20m-s2 | 0.479 / 0.0112 / 0.112 | 2.8 | 2145.11 @0.2 (−2.85%) | 0.078 | 2.78 ms ✓ |

Seed spread for scratch (best-threshold P95): 2137.86 / 2159.82 / 2145.11
(range 21.96 s, 1.0%). Full per-threshold tables with CIs:
`experiments/results/dev-selection.md`.

### Rule picks (all **needs approval**)

- Glimmer L8 arm: L8 @0.2; Glimmer L12 arm: L12 @0.0; Laya arm: Laya @0.0; scratch arm: s0 @0.2.
- E2 checkpoint: **laya-r16 @0.0** (lowest dev P95 overall that passes the gate).

### Surprises

- Laya (406M) beats both Glimmer trunks (4.0B/3.1B) on dev P95 (2118.72 vs
  2145.73/2148.03), and scratch s0 (2137.86) beats them too — at 6 epochs and
  batch 16, the bigger trunks do not help closed-loop. Offline top-1 disagrees
  (L8 best at 0.502).
- The horizon margin was tiny (5.72 s, 0.27%) with heavily overlapping CIs, but
  the rule is mechanical → h2700.
- L12-nf4 edge p99 is 48.90 ms — passes with 1.1 ms margin; L8-bf16 44.78 ms.
- @0.35 thresholds fall back 80–91% yet still beat staging slightly.
- Pre-existing caveat (from `research/results.md`): 15 of the 40 dev instances
  overlap the labelled dev split.

## Deviations
- Part D: copied probe `metrics.json` files to `experiments/results/evac-probe-<h>-metrics.json` (task only requires this for E3 arms in Part E; done so the decision file cites committed files, since `runs/` is git-ignored). Probe closed-loop evals ran on CUDA per runbook §4.

## Blocked / questions
- **Needs Dylan's approval:** the seq-8 rule picks (L8 @0.2, L12 @0.0, Laya @0.0,
  scratch s0 @0.2) and the E2 checkpoint (laya-r16 @0.0). The `model_choice`
  ledger entry and any pre-registration moves are for Dylan/reviewer, not this
  task.
- Note for the reviewer: on dev, Laya beats the Glimmer arms it is meant to
  control for (2118.72 vs 2145.73/2148.03) — E3's direction on the holdout is an
  open question, not a failure of this task.
