---
id: "006"
title: "M3a: fix the confirm.py rewrite (unused Path import) and repeat the rehearsal"
status: done
created: 2026-11-01
report: ops/reports/006-m3a-rewrite-fix.md
---
# M3a: fix the confirm.py rewrite and repeat the rehearsal

Task 005 stopped correctly at the rehearsal (`ops/reports/005-m3a-resume-task3.md`). The `confirm.py` import rewrite left `from pathlib import Path` unused, which fails F401.

**What the reviewer did:**
- Reproduced the failure.
- Verified your suggested fix in a separate throwaway clone. With it, the rehearsal ends with `done:`:
  - 78 passed and 1 skipped;
  - ledger entry 11 `evaluator_update` lists the 9 frozen files;
  - the guard returns exit 1 on the CAGES evaluator, 0 on `cages/sim/core.py`, and 2 in `--hook` mode for a new `judges/ems/FROZEN`.
- Corrected the plan (`docs/superpowers/plans/2026-11-01-m3a-harness-restructure.md`, Task 5 Step 2) to match.

## Do
1. In `maintainer/m3/rewrite_paths.py`, replace this EDITS entry:

   ```python
       ("judges/cages/scripts/confirm.py", "from pathlib import Path\n",
        "from pathlib import Path\n\nfrom loopkit.ledger import repo_root\n"),
   ```

   with:

   ```python
       ("judges/cages/scripts/confirm.py", "import sys\nfrom pathlib import Path\n",
        "import sys\n\nfrom loopkit.ledger import repo_root\n"),
   ```

   Leave the second `confirm.py` entry (the `out = ...` line) unchanged.
2. Run plan Task 5 Step 4's checks: pytest, the name guard and ruff. Commit with `M3a: confirm.py rewrite drops the unused Path import` and an `Assisted-by: agent` trailer, then push.
3. Repeat plan Task 5 Step 5 (the rehearsal) exactly as task 004's adaptation 4 describes:
   - clone from the main checkout;
   - restore the editable install in the main checkout afterwards;
   - delete the clone.
4. Report:
   - the last 30 lines of the rehearsal;
   - the two verification outputs;
   - the commit SHA.

   Then stop. Don't run `maintainer/apply-m3.sh` in the main checkout; the reviewer runs the unlock.

**Stop rule:** any output that differs from the expectations above goes under *Blocked / questions*, and you stop. No ledger entries are written in the main checkout.
