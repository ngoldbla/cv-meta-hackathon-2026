---
name: review
description: Adversarial review of a result before it is called a finding - statistics, leakage, anchors, and threats to validity. Use before publishing anything.
---
# Review

Check each of these, and write findings with a severity (blocker, major, minor):
- **Leakage:**
  - Was the holdout touched more than once?
  - Was any model selected on holdout data?
  - Does any controller read non-observable state without `omniscient=True`?
- **Statistics:**
  - paired tests over instances;
  - multiple-comparison correction;
  - effect sizes with CIs;
  - censored waits included, not dropped.
- **Realism:**
  - Do all anchors in `anchors/` still pass?
  - Are claims limited to the simulated regime?
  - Is life-safety language avoided?
- **Reproducibility:**
  - code SHA, data manifest and ledger entry are all present;
  - `pytest` and `scripts/name_guard.py` pass.
