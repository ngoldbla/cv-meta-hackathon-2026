---
id: "005"
title: "M3a resumed: plan Tasks 3-5 with the corrected Task 3 test (replaces the blocked remainder of 004)"
status: in_progress
created: 2026-11-01
report: ops/reports/005-m3a-resume-task3.md
---
# M3a resumed: plan Tasks 3–5

Task 004 stopped correctly at plan Task 3. The plan's test code used `%`-formatting, which the ruff gate rejects (UP031) (`ops/reports/004-m3a-harness-restructure.md`). The plan is now corrected in `docs/superpowers/plans/2026-11-01-m3a-harness-restructure.md`: `test_hook_mode_exits_2_on_a_frozen_file` builds its code string with an f-string, and its behavior is unchanged.

The reviewer also ran ruff over every complete Python block in the M3a and M3b plans, with the repo's config and `loopkit`, `cages` and `ems` as first-party. No other violations remain.

**What to do:**
- Plan Tasks 1–2 are already done (`14d27d6`, `f35f0a3`). Don't redo them.
- Execute plan **Tasks 3, 4 and 5** as written, using all five runner adaptations from `ops/tasks/004-m3a-harness-restructure.md`:
  1. the main checkout on `main`, with a commit and push per plan task;
  2. record per plan task: the tests written, the failing run, the passing run, the commit SHA;
  3. run `.venv/bin/python -m pytest` from the root, with no `pip install` in Tasks 3–4;
  4. the rehearsal clones from the main checkout;
  5. stop after Task 5. Don't run `maintainer/apply-m3.sh` in the main checkout, and don't edit any frozen path.

**Expected counts:**
- after Task 3, the full suite is 68 + 4 = 72 passed and 1 skipped;
- after Task 4, 74 passed and 1 skipped;
- the rehearsal passes, including `tests/test_judges_layout.py`.

**Stop rule:** any expected output that differs from the plan goes under *Blocked / questions*, and you stop. The report format is the same as 004's. Nothing here is a finding, and no ledger entries are written in the main checkout.
