# Research journal

## 2026-10-26: seed
- Built the simulator, crowd model, CAGES pipeline, decision models and harness (see git log).
- Validated:
  - round-trip time vs Barney's formula, within 2%;
  - social-force diagram vs Weidmann, RMSE 0.09 m/s over 0.5–4 p/m²;
  - counterfactual labels vs brute-force replay, exact match.
- JuPedSim was not installable in the build container; it remains an optional backend.
- Timestral could not be installed in the build container (external git install not permitted there). Its adapter follows the documented API and is unexercised.
- Next: v0-mini generation, the dev baseline comparison, a tiny training run, then pre-registering H1–H3 in the ledger.

## 2026-10-27: v0-mini, tiny model, dev comparison
- Generated CAGES v0-mini: 1,532 train and 382 dev labelled decisions, in about 24 min on 4 CPUs. Ledger entry 3. Pre-registered H1–H3 (entries 0–2).
- Trained the tiny scratch model (0.87M parameters, 40 epochs, 3.4 min). Offline it is comparable to ESA, not better.
- Closed-loop dev (n=20; see `research/results.md`):
  - schedule pre-positioning: −29% P95 vs ESA;
  - mixture at threshold 0: −13.5% P95 beyond pre-positioning, with 20/20 instances improved;
  - H1 dev estimate: 98.4% understatement.
- Caveats: the schedule forecaster is optimistic (it knows the true release profile); dev overlap; n=20.
- Next:
  1. Replace the schedule prior with a learned forecaster (Timestral) and re-run on dev.
  2. Scale CAGES (cloud step 1).
  3. Tune the confidence threshold on dev.
  4. Run the decapitated Glimmer, Laya and scratch-20M runs on GPU.
  5. Then the H1/H2 holdout runs, executed by the salt holder.

## 2026-10-27: handoff to the GPU machine
- Training is now CUDA-ready:
  - automatic device selection;
  - QLoRA (nf4) for 16 GB cards;
  - head-plus-adapter checkpoints, so a trunk can be reloaded in bf16 or 4-bit (round-trip tested).
- Forecast evaluation (2 dev instances, smoke test only):
  - schedule prior: weighted error 8.6% at 600 s, because it knows the true profile;
  - hall-call history alone: about 99%, because calls hide the crowd.
  - So a learned forecaster needs the event schedule as a known-future covariate.
- Evaluator v1.1 is prepared as a reviewed patch (`maintainer/`). Applying it is the maintainer's call; an agent cannot unfreeze the evaluator.
- Next: `docs/runbook-gpu.md` §0–7 on the RTX 5060 Ti machine; the loop is driven from Muse Code per `docs/runbook-loop.md`.

## 2026-10-27: gpu-phase — forecaster eval, cages-v0, Glimmer trunks
- Forecaster eval (n=15 dev, Timestral on CUDA; `experiments/results/forecast_eval.json`):
  - schedule prior: 11.4% WAPE at 600 s (knows the true release profile);
  - recent_only (hall calls alone): ~100% (hidden-queue effect, as expected);
  - timestral blend 0.5: 54.1%; timestral_only: 106.4%.
  - Timestral alone is clearly worse than the schedule prior, so the prior stands; any pre-positioning claim assumes a published schedule.
  - Fixed a CUDA bug in `cages/forecast/timestral_adapter.py`: forecast quantiles are now moved to host memory before numpy conversion.
- Scaled the dataset (`datasets/cages-v0`, committed, 5.4 MB): 600 train instances (15,189 states, ~52 min on 20 workers) and 100 dev (2,546 states); card stats in `datasets/cages-v0/stats.json` (ESA matches best action on ~30% of train states).
- Downloaded Muse-Glimmer-30B (~56 GB cache) and cut two bf16 trunks: L8 (3.87B params, 97 tensors kept) and L12 (5.81B params, 145 kept). Trunks live in `runs/` (git-ignored); decapitation records copied to `experiments/results/`.
- No holdout or confirmatory runs were executed in this session.

## 2026-10-27: forecaster verdict and prior robustness (this container)
- Reviewed the GPU-machine report:
  - CAGES v0: 15,189 / 2,546 labelled decisions;
  - Glimmer trunks: L8 3.87B, L12 5.81B parameters;
  - zero-shot Timestral fails on hall-call series (WAPE ≥ 1.0).
- Closed loop with a misspecified prior (flat profile, attendance ±30–43%): P95 −28.4 to −28.5% vs ESA, against −28.7% for the exact prior. The pre-positioning gain doesn't depend on the optimistic prior.
- Fixed `scripts/install_git_hooks.sh` to use the venv.
- Next:
  1. Apply evaluator v1.1 (maintainer).
  2. H3 training runs on the GPU (L8 bf16 LoRA, L12 QLoRA, Laya, scratch-20M on CAGES v0).
  3. Check that the mixture holds up under the misspecified prior.
  4. Dev selection and the edge benchmark.

## 2026-10-28: pivot to subway and bus evacuation
- **Decision (Dylan):** a hard pivot from elevators to emergency evacuation by train and bus, treated as "trains instead of elevators". The elevator code is deleted, CAGES keeps its name with E = Evacuation, and calibration is to the NYC subway and buses.
  - Task 001 (elevator GPU work) was withdrawn before it started.
  - Ledger entry 5 withdraws H1–H3; no holdout was ever run.
  - The last elevator commit is `5b9ee7e`. Pushing a tag from the build container was refused by the git proxy, so that commit is recorded here instead.
- **Built:**
  - a line simulator for the 7 line: 22 stations from MTA GTFS, two tracks, no overtaking, one train per signal block, terminal turnbacks, load-dependent dwell and door holds;
  - Corona Yard spare trains and shuttle buses;
  - platform-crowding alerts answered by one of eight slots;
  - five worst-case failure modes;
  - true vs operator-logged waits;
  - calibration from MTA GTFS (feed `20261028-fall-2026-pick`) and 2024 hourly ridership, with Mets–Willets Point's busiest hour at 13,165 entries.
  - The baselines, features, labeller, decision-model inputs, gym env, MCP tools and anchors were rewritten. The frozen evaluator and instances at v2.0 wait in `maintainer/v2/` for the maintainer.
- **Validated:** all tests pass in the v2 overlay (`research/results.md`, "Validation").
- **Results (dev, exploratory; `research/results.md`):**
  - CAGES v0-mini: 419 / 153 labelled alerts (ledger entry 6).
  - Staging yard trains and buses on the declaration cuts P95 by 18% vs current reactive practice.
  - A tiny decision model adds −1.4% [−2.3, −0.5] beyond staging.
  - The rolling-horizon planner is worse than the simple express rule.
  - Logs understate true waits by 72.5%.
- **Next:**
  1. Dylan applies `maintainer/apply-v2.sh` and reviews the E1–E3 drafts (`research/prereg/drafts/`).
  2. Label-horizon test (done, `experiments/results/label-horizon-v0mini.json`): with 2,700 s labels "no action" is best in 29% of alerts instead of 51%, but the tiny model gains nothing over staging (+0.4% [−2.0, +3.8] vs −1.4% at 900 s). Compare both horizons on CAGES v0.
  3. Scale to CAGES v0 and run the E3 backbones on the GPU (runbook §2–5, through the mailbox).

## 2026-10-29: CAGES v0, horizon choice, E3 backbones (task 002, done)
- **Laya reproducible:** `scripts/extract_laya_encoder.py` rebuilds `runs/laya-encoder` byte-identically from `convaiinnovations/laya` at `7b928d82…` (170 tensors, 394.8M params).
- **Protocol fixed first:** ledger seq 8 records the horizon rule, the six E3 arms and the dev-selection rule before any result existed.
- **CAGES v0** (ledger seqs 9–10): 3,000/300 instances → 23,554/2,360 labelled alerts at each of h900 and h2700, from byte-identical specs. Cards: no-action-best 52%→23%, median action gap 5%→10% at the longer horizon.
- **Horizon:** the 3.4M scratch probes give mixture@0.0 dev P95 2142.69 (h900) vs 2136.97 (h2700); the rule picks h2700 mechanically (`experiments/results/label-horizon-v0.md`). Margin 5.72 s with overlapping CIs.
- **E3 arms** (all 6 epochs, batch 16, lr 2e-4, no OOM): L8-bf16 52 min, L12-nf4 104 min, Laya 17 min, scratch ×3 seeds ~3 min each. Offline dev top-1: s1 0.505, L8 0.502, s2 0.479, Laya 0.455, s0 0.449, L12 0.420 (`experiments/results/evac-*-metrics.json`).
- **Dev selection** (`experiments/results/dev-selection.md`, 40 instances): best P95 per arm — Laya @0.0 2118.72 (−3.45% vs staging), scratch s0 @0.2 2137.86, L8 @0.2 2145.73, L12 @0.0 2148.03. Laya and scratch beat both Glimmer trunks in closed loop despite L8's better offline top-1.
- **Edge:** all pass p99 ≤ 50 ms at trained precision — L12-nf4 48.90, L8-bf16 44.78, Laya 29.45, scratch ~3 ms (`experiments/results/edge-*.json`). E2 checkpoint by the rule: laya-r16 @0.0.
- **Needs approval:** the four arm picks and the E2 checkpoint; then `model_choice`, E1–E3 registration, and Dylan's confirmatory runs. Full record: `ops/reports/002-transit-v0-and-backbones.md`.

## 2026-10-29 — autoresearch dry run `cages-dry-run` (blue), baseline
- Branch `ar/blue/cages-dry-run`: M2 wiring test, not a finding.
- Baseline p95 2424.61 over 10 dev instances (config threshold 0.2), 181 s. Log: `research/autoresearch/cages-dry-run/autoresearch.jsonl`.

## 2026-10-29 — autoresearch dry run `cages-dry-run` (blue), finished
- 3 iterations on branch `ar/blue/cages-dry-run`: iter 1 threshold→0.0 reverted (2434.69), iter 2 lr→3e-4 kept (2416.78), iter 3 epochs→8 reverted (2425.30). Baseline 2424.61.
- Wiring test only; numbers are not findings. Full loop record in the branch log and `ops/reports/003-cages-dry-run.md` on main.
