---
id: "011"
title: "M3d: EMS evaluator, scenarios, b1, counterfactual reports, benchmark and compute gate (plan Tasks 1-4)"
status: open
created: 2026-11-01
report: ops/reports/011-m3d-ems-evaluator.md
---
# M3d: EMS evaluator

Follow `docs/superpowers/plans/2026-11-01-m3d-ems-evaluator.md` Tasks 1–4 exactly, in the main checkout on `main`, with a commit and push per task.

**Reviewer pre-flight (2026-11-01):**
- On a clean checkout of `4aade7a`, the reviewer applied the plan's patch and files exactly as written. All 13 files came out byte-identical to the verified prototype.
- Ruff is clean. The full suite gives 122 passed and 1 skipped. The name guard passes.
- Every Task 4 command was run on the real bundle, with the expected numbers recorded in the plan.

**Rules:**
- Dev days only. Never call `eval_holdout`, and never read a holdout window.
- Do not change code, parameters, bounds or b1 thresholds to move a number. Any result that differs from the plan's expected values by more than 0.5% (or a compute-gate wall time over 600 s) means block.
- Do not create `judges/ems/FROZEN` and do not write ledger entries. The freeze is a separate maintainer step after Dylan's review.

**Report:** per plan task, the test runs, the commands and their wall times, and the full outputs of Task 4 Steps 3–6. Nothing here is a finding.
