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
