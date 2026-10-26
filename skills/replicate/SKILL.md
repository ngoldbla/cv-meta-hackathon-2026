---
name: replicate
description: Reproduce the baseline controllers on the CAGES dev split before proposing anything new. Use at the start of every research cycle.
---
# Replicate baselines

1. `pytest -q` must pass. It covers Barney's round-trip time, the Weidmann diagram, the failure-mode effects and label brute-force agreement.
2. Call the MCP tool `eval_dev` with:
   `["closest_car", "eta", "esa", "esa_omniscient", "tsai_standby", "esa+schedule"]` and `n` ≥ 20.
3. Compare the numbers with `research/results.md`. If they differ beyond seed noise, stop and investigate before going further.
4. Write a journal entry: date, controllers, n, and the headline tail metrics (P95, CVaR95, peak landing density).
