---
id: "010"
title: "M3c: EMS simulator, b0, fit and the single anchor check (plan Tasks 1-4)"
status: done
created: 2026-11-01
report: ops/reports/010-m3c-ems-simulator.md
---
# M3c: EMS simulator

Follow `docs/superpowers/plans/2026-11-01-m3c-ems-simulator.md` Tasks 1–4 exactly, in the main checkout on `main`, with a commit and push per task.

**Reviewer pre-flight (2026-11-01):** the reviewer built, linted (ruff clean), unit-tested (7 of 7) and ran this exact code end to end on the real bundle. It reproduced the expected anchor table twice.

**Rules:**
- The anchor check runs **once**, and its expected result is 7 of 10 (exit 1). This was frozen by Dylan's decision.
- Do not change code, inputs or tolerances to make more checks pass. Any difference from the plan's expected numbers means block.

**Report:** per plan task, the test runs, the commands and their run times, the exact fitted values (`fleet_k`, tier factors, sigma) and the anchor table. Nothing here is a finding, and no ledger entries are written.
