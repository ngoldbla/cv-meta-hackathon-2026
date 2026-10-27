---
name: confirm
description: Run the single confirmatory holdout evaluation for a pre-registered hypothesis. Use exactly once per pre-registration.
---
# Confirm

1. Check that the pre-registration is in the ledger (`Ledger().prereg(ID)`) and that no holdout run exists for it.
2. The orchestrator, not the agent, provides `CAGES_HOLDOUT_SALT` in the environment of the MCP server.
3. Call `eval_holdout(controllers, prereg_id, comparisons, n)`. The ledger records the report hash automatically.
4. Write the outcome to `research/results.md` exactly as computed, whether it supports the hypothesis or not.
