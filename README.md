# CAGES: worst-case-ready elevator control

**CAGES** = **C**alibrated, **A**dversarially **G**enerated **E**levator **S**imulation dataset.
Author: Dylan Goldblatt. Code: MIT. Data: CC BY 4.0.

## The problem

When a crowd surges into an elevator lobby, today's best group-control algorithms fail by design:
- they assume infinite car capacity and a known count of waiting people [1];
- they treat everyone behind a single hall call as invisible, and start the waiting clock at the button press [2];
- they lose nearly all the value of prediction once cars are saturated [3].

As a result, crush-level waits, stranded passengers and dangerous lobby densities go unmodelled, unmeasured and unmanaged.

[1] Nikovski & Brand, *Decision-Theoretic Group Elevator Scheduling*, ICAPS 2003 (MERL TR2003-61)
[2] Ramalingam, Raghunathan & Nikovski, *Submodular Function Maximization for Group Elevator Scheduling*, ICAPS 2017
[3] Zhang et al., *Transformer Networks for Predictive Group Elevator Control*, ECC 2022 (arXiv 2208.08948)

## The mission

We make elevator banks ready for the worst case with an open three-model mixture trained on CAGES:
- **Muse** orchestrates the science;
- **Timestral-28M** forecasts the surge;
- a **decapitated local Muse** makes fast, consistent dispatch decisions.

The mixture has four parts:
- **CAGES data.**
  - An event-driven simulator, calibrated to real elevator banks (NYC DOB registry) and real crowd flows (Jülich data, via published statistics).
  - Scenarios combine five worst-case failure modes.
  - Every decision is labelled with its counterfactual outcome, and each run records both the true passenger waits and what a real controller would log.
- **Forecast.** Timestral-28M predicts per-floor demand with the event schedule as a known-future input, and pre-positions idle cars *before* the surge.
- **Decide.** Muse Glimmer is decapitated (LM head removed) and truncated to its first layers. A per-car value head scores every car in one deterministic pass with a calibrated confidence. When confidence is low, the decision falls back to an open rebuild of MERL's ESA planner.
  - Controls: Laya-421M and a 20M transformer trained from scratch.
- **Orchestrate.** A Muse model runs the Feynman loop (audit → replicate → pre-register → bounded search → one holdout test → review) through MCP tools and Markdown skills. It works offline only and is never in the control path.

## How the code runs the loop

| Piece | Where |
|---|---|
| Simulator and failure modes | `cages/sim/` |
| Crowd model (social force + boids, Weidmann-calibrated; optional JuPedSim) | `cages/crowd/` |
| Baselines (closest car, ETA, ESA, ESA-omniscient, Tsai standby, forecast parking) | `cages/controllers/` |
| CAGES generator, counterfactual labeller, registry stock | `cages/data/` |
| Forecasting (schedule baseline, Timestral adapter) | `cages/forecast/` |
| Decapitation tool, decision model, training | `cages/model/` |
| Frozen evaluator, hash-chained ledger, MCP server | `cages/harness/` |
| Gymnasium env `cages/Dispatch-v0` | `cages/envs/` |
| Agent rules and loop skills | `AGENTS.md`, `skills/` |
| Pre-registrations and ledger | `research/` |
| Budget-capped cloud jobs, edge benchmark | `cloud/`, `scripts/edge_bench.py` |

Guardrails are enforced in code:
- the evaluator is frozen (`scripts/guard_paths.py`);
- holdout seeds derive from `CAGES_HOLDOUT_SALT`, which never enters the repository;
- each pre-registration gets exactly one holdout run, recorded in `research/ledger.jsonl`.

## Quick start

```bash
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev,model,hf,mcp]"
pytest -q                                          # simulator, crowd, labels, models, harness
python -m cages.data.generate --out datasets/cages-v0-mini --train 60 --dev 15
python -m cages.model.train --data datasets/cages-v0-mini --out runs/scratch
python -m cages.harness.mcp_server                 # expose the loop to any agent harness
```

Results so far, with their caveats, are in [`research/results.md`](research/results.md).

Next phase (CUDA, learned forecaster, backbone sweep): [`docs/runbook-gpu.md`](docs/runbook-gpu.md).
Running the research loop from Muse Code: [`docs/runbook-loop.md`](docs/runbook-loop.md).
Maintainer-only changes to frozen paths: [`maintainer/README.md`](maintainer/README.md).
