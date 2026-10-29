# CAGES: worst-case-ready evacuation by subway and bus

**CAGES** = **C**alibrated, **A**dversarially **G**enerated **E**vacuation **S**imulation.
Author: Dylan Goldblatt. Code: MIT. Data: CC BY 4.0.

## The problem

When an emergency empties a crowded venue into its subway station, today's rail and bus dispatch methods fail by design:
- they reschedule trains against passenger flows they assume are known [1];
- they cannot see the people left behind on platforms when full trains depart [2];
- they plan bus evacuations for evacuee counts fixed in advance [3].

As a result, platform crush, stranded evacuees and dangerous densities go unmodelled, unmeasured and unmanaged.

[1] Gao, Kroon, Schmidt & Yang, *Rescheduling a metro line in an over-crowded situation after disruptions*, Transp. Res. B 93 (2016) 425–449
[2] *Measuring Left-Behinds on Subway*, MassDOT research report (2018)
[3] Bish, *Planning for a bus-based evacuation*, OR Spectrum 33(3) (2011) 629–654

## The mission

We make subway and bus service ready for the worst-case evacuation with an open three-model mixture trained on CAGES:
- **Muse** orchestrates the science;
- **Timestral-28M** forecasts;
- a **decapitated local Muse** decides which train or bus answers each crowded platform, with an open rolling-horizon dispatcher as the fallback.

The mixture has four parts:
- **CAGES data.**
  - An event-driven simulation of the NYC **7 line**, calibrated to MTA open data: GTFS station positions, run times and headways, and 2024 hourly ridership.
  - The narrow target is an emergency evacuation of the venue at **Mets–Willets Point** (Citi Field, up to 41,922 people), with spare trains from Corona Yard and shuttle buses.
  - Scenarios combine five worst-case failure modes (`docs/failure-modes.md`).
  - Every decision is labelled with its counterfactual outcome, and each run records both the true passenger waits and what the operator's logs show.
- **Forecast.** On the emergency declaration, the forecast stages yard trains and buses for the expected crowd.
- **Decide.** Muse Glimmer is decapitated (LM head removed) and truncated to its first layers. A per-slot value head scores every candidate in one deterministic pass, with a calibrated confidence. The candidates are: no action, one of the four nearest trains sent express, a yard train, or a bus. When confidence is low, the rolling-horizon dispatcher decides.
  - Controls: Laya-421M and a 20M transformer trained from scratch.
- **Orchestrate.** A Muse model runs the Feynman loop (audit → replicate → pre-register → bounded search → one holdout test → review) through MCP tools and Markdown skills. It works offline only and is never in the control path.

## How the simulation maps the old elevator design

| Elevator (until commit `5b9ee7e`) | Transit (now) |
|---|---|
| car | train on the 7 line, or shuttle bus |
| floor | station (22, Flushing–Main St to 34 St–Hudson Yards) |
| hall call | platform-crowding alert: coarse levels, delayed |
| landing density | platform density, with spill-back into the plaza outside |
| which car answers the call | which vehicle answers the alert |
| parking / standby | staging yard trains and buses on the emergency declaration |
| ESA planner | rolling-horizon dispatcher |

## How the code runs the loop

| Piece | Where |
|---|---|
| Line simulator and failure modes | `cages/sim/` |
| MTA calibration data (aggregates) | `cages/data/stock.py`, `cages/data/mta_7line.json` |
| Crowd model (social force + boids, Weidmann-calibrated; optional JuPedSim) | `cages/crowd/` |
| Baselines (timetable, next train, express rule, rolling horizon, omniscient reference, staging) | `cages/controllers/` |
| CAGES generator and counterfactual labeller | `cages/data/` |
| Forecasting (schedule prior, Timestral adapter) | `cages/forecast/` |
| Decapitation tool, decision model, training | `cages/model/` |
| Frozen evaluator, hash-chained ledger, MCP server | `cages/harness/` |
| Gymnasium env `cages/Evacuation-v0` | `cages/envs/` |
| Agent rules, loop skills, task mailbox | `AGENTS.md`, `skills/`, `ops/` |
| Pre-registrations and ledger | `research/` |
| Edge benchmark, budget-capped cloud jobs | `scripts/edge_bench.py`, `cloud/` |

Guardrails are enforced in code:
- the evaluator is frozen (`scripts/guard_paths.py`);
- holdout seeds derive from `CAGES_HOLDOUT_SALT`, which never enters the repository;
- each pre-registration gets exactly one holdout run, recorded in `research/ledger.jsonl`.

## Quick start

```bash
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev,model,hf,mcp]"
pytest -q                                          # line physics, crowd, labels, models, harness
python -m cages.cli simulate --controller staging  # one evacuation, true vs logged metrics
python -m cages.data.generate --out datasets/cages-v0-mini --train 60 --dev 15
python -m cages.model.train --data datasets/cages-v0-mini --out runs/scratch
python -m cages.harness.mcp_server                 # expose the loop to any agent harness
```

Results so far, with their caveats, are in [`research/results.md`](../research/results.md).

GPU phase (backbones, edge latency): [`docs/runbook-gpu.md`](runbook-gpu.md).
Running the research loop from Muse Code: [`docs/runbook-loop.md`](runbook-loop.md).
Maintainer-only changes to frozen paths: [`maintainer/README.md`](../maintainer/README.md).

*Safety scope: simulation research only. Nothing here certifies a station, a train service or an evacuation plan.*
