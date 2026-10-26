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
