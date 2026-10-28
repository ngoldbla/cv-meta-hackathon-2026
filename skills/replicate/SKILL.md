---
name: replicate
description: Reproduce the baseline controllers on the CAGES dev split before proposing anything new. Use at the start of every research cycle.
---
# Replicate baselines

1. `pytest -q` must pass. It covers the GTFS run times, one train per signal block, load-dependent dwell, the Weidmann diagram, the failure-mode effects and label brute-force agreement.
2. Call the MCP tool `eval_dev` with:
   `["timetable", "next_train", "express_rule", "rolling_horizon", "rolling_horizon_omniscient", "staging", "staging+express"]` and `n` ≥ 20.
3. Compare the numbers with `research/results.md`. If they differ beyond seed noise, stop and investigate before going further.
4. Write a journal entry: date, controllers, n, and the headline tail metrics (P95, CVaR95, peak density at the event station) and the operator-log understatement.
