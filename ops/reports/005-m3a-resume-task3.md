# Report 005: M3a resumed: plan Tasks 3-5 with the corrected Task 3 test
Status: blocked
Branch head at start: 3765acdb8e987739587fd291468451fdafe0e851  ·  at finish: <sha>

## Summary
Plan Tasks 3–4 are committed and pushed (`loopkit.guard`, `record_freeze`; all test counts match the plan). Plan Task 5's staged material is committed and pushed and its Step 4 checks pass, but the Step 5 rehearsal fails: `apply-m3.sh` exits at its `ruff check` with one F401 — the plan's `confirm.py` rewrite leaves `from pathlib import Path` unused. The clone made no commits and recorded no ledger entry; the shared `.venv` was restored to the main checkout and the clone deleted. Per the stop rule the run blocks here instead of adapting the plan. The fix is a one-entry plan correction (see Blocked / questions).

## Work done
- Claimed task 005.
- Baseline before plan work: `.venv/bin/python -m pytest -q` → 68 passed, 1 skipped (matches plan: 68 + 4 = 72 after Task 3).
- Plan Task 3 done: `loopkit/guard.py`, `tests/test_loopkit_guard.py`, `scripts/ar_check.py` line 79, `scripts/ar_worktree.sh` venv block, `tests/test_ar_worktree.py` fixture + assertion. Did not run `pip install -e .`.
- Plan Task 4 done: `scripts/record_freeze.py`, `tests/test_record_freeze.py`, `PYTHONPATH` export in `skills/autoresearch/SKILL.md` Step 4 and `ops/templates/autoresearch-task.md`. Did not run `pip install -e .`.
- Plan Task 5 Steps 1–4 done: staged `maintainer/m3/*` + `apply-m3.sh`, README section; Step 4 checks pass.
- Plan Task 5 Step 5 rehearsal run per adaptation 4 and FAILED at the script's `ruff check` (see Results). Clone made no commits; `.venv` restored to the main checkout (imports resolve under `/home/ndgold/cv-meta-hackathon-2026/`); clone deleted. Main checkout green at `74 passed, 1 skipped`.

## Results

### Plan Task 3: `loopkit.guard`, `ar_check` caller, judge venv links
- Tests written: `tests/test_loopkit_guard.py` (4 tests: frozen_set combines program + manifests, check flags frozen/new manifests, --staged blocks unless unlocked + ledger rewrite, --hook exits 2 via corrected f-string); extended `tests/test_ar_worktree.py` (`judges/j/keep.txt` fixture, judge `.venv` symlink assertion).
- Failing run: `.venv/bin/python -m pytest tests/test_loopkit_guard.py tests/test_ar_worktree.py -q` → `5 failed, 1 passed`: 4 × `ModuleNotFoundError: No module named 'loopkit.guard'`, plus `test_creates_worktree_branch_and_venv_link` failing on the judge `.venv` assertion — as expected.
- Passing run: `.venv/bin/python -m pytest tests/test_loopkit_guard.py tests/test_ar_worktree.py tests/test_ar_check.py -q` → `12 passed in 0.35s` (4 + 2 + 6). Full suite: `72 passed, 1 skipped` — as expected.
- Commit: `fa67e424f18b8c7017edfc92c9c2c89d36969ab4` ("Add loopkit.guard (per-judge FROZEN manifests); ar_check and ar_worktree ready for judges/").

### Plan Task 4: `scripts/record_freeze.py`, worktree imports via `PYTHONPATH`
- Tests written: `tests/test_record_freeze.py` (2 tests: frozen_hashes covers existing frozen files only, record appends a verifiable entry).
- Failing run: `.venv/bin/python -m pytest tests/test_record_freeze.py -q` → `1 error` during collection, `FileNotFoundError` for `scripts/record_freeze.py` — as expected.
- Passing run: `.venv/bin/python -m pytest tests/test_record_freeze.py tests/test_program_docs.py -q` → `9 passed` (2 + 7). Full suite: `74 passed, 1 skipped` — as expected.
- Commit: `b7405a6d512f7f8bd1325a783fc69b8a69f0f894` ("Add record_freeze; loop benchmarks import the worktree's code via PYTHONPATH").

### Plan Task 5: unlock script, staged files, clone dry run
- Files staged: `maintainer/m3/{guard_paths.py,cages_ledger.py,FROZEN,test_judges_layout.py,rewrite_paths.py}`, `maintainer/apply-m3.sh` (+x), `maintainer/README.md` M3a section.
- Step 4 checks: `.venv/bin/python -m pytest -q` → `74 passed, 1 skipped`; `scripts/name_guard.py` → clean; `ruff check .` → clean. `maintainer/m3/test_judges_layout.py` not collected (testpaths is `tests`) — as expected.
- Commit: `e140f9278fd6d632487725732f60c99c25737c31` ("Stage the M3a restructure: apply-m3.sh and maintainer/m3/").
- Step 5 rehearsal (FAILED, plan bug): clone from the main checkout at `e140f92`, symlinked `.venv`, installed hooks, `bash maintainer/apply-m3.sh --no-push`. The script printed `20 rewrites applied`, pytest `78 passed, 1 skipped` (includes the 4 `test_judges_layout.py` tests), name guard clean, then exited at `$RUFF check -q .` with one error — `F401 'pathlib.Path' imported but unused` at `judges/cages/scripts/confirm.py:19`. No `done:` line; HEAD stayed at `e140f92` with 142 uncommitted paths; no ledger entry recorded. Full rehearsal output (18 lines, i.e. the last 30):
  ```
  20 rewrites applied
  ............................................s........................... [ 91%]
  .......                                                                  [100%]
  (warnings summary: 2 gymnasium Box-space UserWarnings in judges/cages/tests/test_harness.py::test_gym_env_api)
  78 passed, 1 skipped, 2 warnings in 26.18s
  F401 [*] `pathlib.Path` imported but unused
    --> judges/cages/scripts/confirm.py:19:21
     |
  17 | import os
  18 | import sys
  19 | from pathlib import Path
     |                     ^^^^
  20 |
  21 | from loopkit.ledger import repo_root
     |
  help: Remove unused import: `pathlib.Path`
  ```
  Verification commands in the failed clone: `.venv/bin/python scripts/guard_paths.py judges/cages/cages/harness/evaluate.py` → prints `frozen: judges/cages/cages/harness/evaluate.py`, `exit=1` (guard wrapper works — the moved layout is otherwise functional); ledger one-liner → `10 dataset_release []` (expected `11 evaluator_update [...]` — differs because the script exited before recording).
  Root cause (verified, not a transcription error): `scripts/confirm.py` uses `Path` exactly once (line 36, the `out = Path(...)` line the rewrite replaces), so the plan's rewrite pair — which keeps `from pathlib import Path` and only adds the `repo_root` import — always leaves an unused import. `ruff check` selects F, so `apply-m3.sh` (`set -e`) can never get past this line as written.

## Deviations
- Each plan-task commit also stages this report file (inbox rule: update the report and commit it with that part's work), alongside the plan's listed files. Commit messages are exactly the plan's.
- The rehearsal's stdout was captured through `tee` to a temp file so the last-30-lines paste is exact; the script failure is evidenced independently by the missing `done:` line and the clone's uncommitted state (HEAD at `e140f92`), not by a pipe exit code.
- Stopped at the plan's Task 5 Step 5 failure per the task's stop rule, although the plan text also contains a "fix it and repeat Step 5" line: that line assumes iteration on `m3-design`, while the task adaptations (which override the plan) say to stop instead of adapting the plan. The staged material on `main` is plan-verbatim.

## Blocked / questions
- **Needs a plan correction (new task, per ops rules):** the `judges/cages/scripts/confirm.py` import rewrite in `maintainer/m3/rewrite_paths.py` (plan Task 5 Step 2) must drop the now-unused `pathlib.Path` import instead of keeping it. Suggested correction — replace the EDITS entry `("judges/cages/scripts/confirm.py", "from pathlib import Path\n", "from pathlib import Path\n\nfrom loopkit.ledger import repo_root\n")` with `("judges/cages/scripts/confirm.py", "import sys\nfrom pathlib import Path\n", "import sys\n\nfrom loopkit.ledger import repo_root\n")` (keeps `loopkit` in its own isort section; matches exactly once). The second confirm.py entry (the `out = ...` line) is unchanged. Then re-run Task 5 Steps 4–5 (re-commit the staged material, repeat the rehearsal).
- Reviewer note: the block-level ruff sweep of the plan's Python could not catch this — the violation exists only in the rewrite *output*. Suggest ruff-checking each post-rewrite file (e.g. by simulating the EDITS) as part of reviewing M3b's rewrites, if any.
- Nothing in this run is a finding. No ledger entries were written in the main checkout; no frozen path was touched (the only rewrites ran inside the deleted throwaway clone).
