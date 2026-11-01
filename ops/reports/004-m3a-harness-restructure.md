# Report 004: M3a harness restructure, Tasks 1-5 with rehearsal
Status: blocked
Branch head at start: 0ffa582523e97eb8e36baebb5a0d1c80e0700640  ·  at finish: 154e69561c1e548b6f61687dbbdcebff105abc19

## Summary
Plan Tasks 1–2 are committed and pushed (`loopkit.ledger`, `loopkit.stats`; all test counts match the plan). Plan Task 3's code and tests were written verbatim and its fail-then-pass runs match the plan (5 failed → 12 passed), but its commit is blocked: the plan's literal test code trips the repo's pre-commit ruff gate (UP031, `%`-formatting), so the step cannot be completed as written. Per the task's stop condition the run stops here instead of adapting the plan. Task 3's files were reverted, leaving the tree green at the Task 2 commit; Tasks 4–5 were not started. The fix is a one-line plan correction (see Blocked / questions).

## Work done
- Claimed task 004.
- Baseline before plan work: `.venv/bin/python -m pytest -q` → 61 passed, 1 skipped (matches plan).
- Plan Task 1 done: `loopkit/__init__.py`, `loopkit/ledger.py`, `tests/test_loopkit_ledger.py`, `pyproject.toml` include += `loopkit*`. Did not run `pip install -e .`.
- Plan Task 2 done: `loopkit/stats.py`, `tests/test_loopkit_stats.py`.
- Plan Task 3 implemented verbatim and verified (fail → pass), but NOT committed: the pre-commit hook rejects the plan's literal test code (UP031). Files reverted to keep the tree green; see Deviations and Blocked / questions.

## Results

### Plan Task 1: `loopkit.ledger`
- Tests written: `tests/test_loopkit_ledger.py` (4 tests: repo_root/DEFAULT, outside-repo refusal, chain verifies identically to CAGES, append/preregister/one-shot).
- Failing run: `.venv/bin/python -m pytest tests/test_loopkit_ledger.py -q` → `4 failed` with `ModuleNotFoundError` (no `loopkit` module), as expected.
- Passing run: same command → `4 passed in 0.17s`.
- Commit: `14d27d67086815eb0f7630d62c265b2924e5f1f8` ("Add loopkit.ledger: the program ledger, found by repository marker").

### Plan Task 2: `loopkit.stats`
- Tests written: `tests/test_loopkit_stats.py` (3 tests: paired matches CAGES evaluator exactly, drops non-finite pairs, Holm adjust/order/NaN).
- Failing run: `.venv/bin/python -m pytest tests/test_loopkit_stats.py -q` → `3 failed` with `ModuleNotFoundError` (no `loopkit.stats`), as expected.
- Passing run: same command → `3 passed in 0.94s`.
- Commit: `f35f0a3a91686ee1ea12360017509fc214b98047` ("Add loopkit.stats: paired comparison (same maths as CAGES v2.0) and Holm").

### Plan Task 3: `loopkit.guard`, `ar_check` caller, judge venv links (NOT committed — blocked)
- Tests written (verbatim from plan, then reverted): `tests/test_loopkit_guard.py` (4 tests: frozen_set combines program + manifests, check flags frozen/new manifests, --staged blocks unless unlocked + ledger rewrite, --hook exits 2); extended `tests/test_ar_worktree.py` (`judges/j/keep.txt` fixture, judge `.venv` symlink assertion). Code written verbatim: `loopkit/guard.py`, `scripts/ar_check.py` line 79, `scripts/ar_worktree.sh` venv block.
- Failing run: `.venv/bin/python -m pytest tests/test_loopkit_guard.py tests/test_ar_worktree.py -q` → `5 failed, 1 passed`: 4 × `ModuleNotFoundError: No module named 'loopkit.guard'`, plus `test_creates_worktree_branch_and_venv_link` failing on the judge `.venv` assertion — as expected.
- Passing run: `.venv/bin/python -m pytest tests/test_loopkit_guard.py tests/test_ar_worktree.py tests/test_ar_check.py -q` → `12 passed in 0.29s` (4 + 2 + 6) — as expected.
- Commit: BLOCKED. `git commit` exits 1 in the pre-commit hook: `ruff check -q .` reports `UP031 Use format specifiers instead of percent format` at `tests/test_loopkit_guard.py:69` (the plan's verbatim `code = ("import sys; sys.path.insert(0, %r); ..." % str(ROOT))`). Full-tree scan shows this is the only violation (`Found 1 error`). Ruff 0.17.3; repo selects `["E", "F", "W", "I", "B", "UP"]`. No other `%`-formatting exists in the plan's Python (checked Tasks 4–5 statically) or the repo.

## Deviations
- Task 3's files (`loopkit/guard.py`, `tests/test_loopkit_guard.py`, edits to `scripts/ar_check.py`, `scripts/ar_worktree.sh`, `tests/test_ar_worktree.py`) were implemented verbatim, verified, then reverted uncommitted. Reason: with them present no commit can pass the pre-commit hook (it runs `ruff check -q .` over the working tree), so the tree was restored to the green Task 2 state to leave `main` committable. Nothing is lost: the content was plan-verbatim.
- Each plan-task commit also stages this report file (inbox rule: update the report and commit it with that part's work), alongside the plan's listed files. Commit messages are exactly the plan's.

## Blocked / questions
- **Needs a plan correction (new task, per ops rules):** plan Task 3 Step 1's `test_hook_mode_exits_2_on_a_frozen_file` uses `%`-formatting (`code = ("import sys; sys.path.insert(0, %r); ..." % str(ROOT))`, plan line ~464–465), which violates the repo's ruff gate (UP rules selected; UP031) and blocks the Task 3 commit. Suggested correction: rephrase with `.format()` or an f-string, e.g. `code = ("import sys; sys.path.insert(0, {!r}); ...".format(str(ROOT)))`, keeping behavior identical. Then re-run Task 3 Steps 1–5 followed by Tasks 4–5.
- Plan clarity note: the plan's Task 3 Step 1 shows the full modified `_repo` helper for `tests/test_ar_worktree.py` (with `git add -A`); the current helper used `--allow-empty`, so the step is a wholesale helper replacement, not an addition. Worked as written.
- Nothing in this run is a finding. No ledger entries were written in the main checkout; no frozen path was touched (verified: `git status` shows only the reverted Task 3 files plus this report and the task file).
