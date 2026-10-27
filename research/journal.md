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
