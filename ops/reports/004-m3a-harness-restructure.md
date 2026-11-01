# Report 004: M3a harness restructure, Tasks 1-5 with rehearsal
Status: in_progress
Branch head at start: 0ffa582523e97eb8e36baebb5a0d1c80e0700640  ·  at finish: TBD

## Summary
TBD.

## Work done
- Claimed task 004.
- Baseline before plan work: `.venv/bin/python -m pytest -q` → 61 passed, 1 skipped (matches plan).
- Plan Task 1 done: `loopkit/__init__.py`, `loopkit/ledger.py`, `tests/test_loopkit_ledger.py`, `pyproject.toml` include += `loopkit*`. Did not run `pip install -e .`.

## Results

### Plan Task 1: `loopkit.ledger`
- Tests written: `tests/test_loopkit_ledger.py` (4 tests: repo_root/DEFAULT, outside-repo refusal, chain verifies identically to CAGES, append/preregister/one-shot).
- Failing run: `.venv/bin/python -m pytest tests/test_loopkit_ledger.py -q` → `4 failed` with `ModuleNotFoundError` (no `loopkit` module), as expected.
- Passing run: same command → `4 passed in 0.17s`.
- Commit: see `git log` ("Add loopkit.ledger: the program ledger, found by repository marker").

## Deviations
None yet.

## Blocked / questions
None yet.
