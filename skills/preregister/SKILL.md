---
name: preregister
description: Write and hash-commit a hypothesis before any confirmatory (holdout) test. Use whenever a result might be claimed.
---
# Pre-register

1. Copy `research/prereg/TEMPLATE.md` to `research/prereg/<ID>.md`. Fill in:
   - `id:`
   - the claim;
   - the primary metric (P95, CVaR95, peak landing density or logger understatement);
   - the comparison pairs;
   - the decision threshold;
   - the statistical test (paired Wilcoxon plus a bootstrap 95% CI over holdout instances, Holm correction across metrics);
   - n.
2. Commit the file to git.
3. Call `ledger_commit(kind="prereg", prereg_path=...)`. The ledger stores its SHA-256 in the hash chain.
4. Once committed, the pre-registration may not be edited. A changed plan needs a new ID.
