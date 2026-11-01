---
id: "004"
title: "M3a: shared loopkit harness and the CAGES move, rehearsed (plan Tasks 1-5)"
status: open
created: 2026-11-01
report: ops/reports/004-m3a-harness-restructure.md
---
# M3a: shared loopkit harness and the CAGES move, rehearsed

Read these first:
- `AGENTS.md`;
- `docs/superpowers/specs/2026-11-01-m3-ems-judge-design.md` §4;
- the plan `docs/superpowers/plans/2026-11-01-m3a-harness-restructure.md`.

Then execute plan **Tasks 1–5** exactly as written, in order. The runner adaptations below override the plan where they differ.

## Runner adaptations
1. **Where to work:** the main checkout (`/home/ndgold/cv-meta-hackathon-2026`), on branch `main`, not a worktree or `m3-design`.
   - Commit each plan task with the message the plan gives.
   - Push after each task, running `git pull --no-rebase` first.
2. **The plan's header** names a sub-skill you don't have; ignore it and follow the plan's steps directly. In the report, record for each plan task:
   - the tests written;
   - the first lines of the failing run;
   - the passing run;
   - the commit SHA.
3. **How to run things:** run Python as `.venv/bin/python -m pytest …` from the repository root. Install nothing with `pip`. Task 1's install warning is about worktrees, and it still applies to you: don't run `pip install -e .` in Tasks 1–4.
4. **The rehearsal (plan Task 5 Step 5):** clone from the main checkout instead of the survey worktree. The clone is already on `main`, so skip `git checkout -b main`:

   ```bash
   S="$(mktemp -d)/m3a-dry"
   git clone -q /home/ndgold/cv-meta-hackathon-2026 "$S"
   cd "$S" && ln -s /home/ndgold/cv-meta-hackathon-2026/.venv .venv
   bash scripts/install_git_hooks.sh
   git config user.name "Dylan Goldblatt" && git config user.email "70771914+ngoldbla@users.noreply.github.com"
   bash maintainer/apply-m3.sh --no-push
   ```

   Then follow the rest of Step 5:
   - run the two verification commands;
   - restore the editable install in the main checkout, which must print paths under `/home/ndgold/cv-meta-hackathon-2026/`;
   - delete the clone.

   Paste into the report the last 30 lines of the rehearsal output and both verification outputs.
5. **Stop after Task 5.**
   - Don't do plan Task 6.
   - Don't run `maintainer/apply-m3.sh` in the main checkout.
   - Don't edit any frozen path.

   The reviewer runs the unlock.

## Stop and report
- **If any expected output differs from the plan,** stop and record it under *Blocked / questions* instead of adapting the plan. That includes:
  - test counts;
  - the rehearsal's ledger entry 11, which must list the 9 frozen files;
  - the guard's exit code.
- **The report covers:**
  - each plan task, as in adaptation 2;
  - deviations;
  - anything in the plan that was unclear.
- **Nothing here is a finding.** Write no ledger entries in the main checkout. The rehearsal's entry exists only in the throwaway clone.
