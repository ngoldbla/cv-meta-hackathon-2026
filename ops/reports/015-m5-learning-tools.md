# Report 015: M5: learning tools on Modal (learned policy base, rollouts and labels, H100 trainer, ES, M5 benches)
Status: done
Branch head at start: ac45acc9d3e537a2a303a3db5cd4ee893782f500  ·  at finish: 3f618a3f41f0335d87fafba44cad0df4d4e42b83

## Summary
Task 015 done. Reviewer patch applied cleanly with no hand edits; full suite 141 passed, 1 skipped; name_guard and ruff clean. Modal app `ems-m5` deployed with scenario, rollout, train. Smoke tests all matched: gen gave 24 days / 104226 decisions / 480 labelled; H100 train returned 0 with weights saved (~15 s GPU); unweighted candidate bench gave METRIC ratio_b1=1.0000. Spend: $2.41 of $200.00.

## Results
- Step 2: pytest 141 passed, 1 skipped; name_guard rc=0; ruff "All checks passed!".
- Step 3: `modal deploy cloud/ems_modal.py` created Function scenario, Function rollout, Function train; "App deployed in 2.200s".
- Step 4 (from `judges/ems`): `emslearn.cli gen` -> `{"out": "data/smoke/t015", "days": 24, "decisions": 104226, "labelled": 480}` (exact match); `emslearn.cli train` (epochs 10) -> rc=0, saved `/tmp/m5smoke_candidate.npz` (21666 bytes), gpu_seconds 15.0, loss 2.6148 -> 2.3285; `ems_blue_bench_m5.py --n 48` on weightless copy -> `METRIC ratio_b1=1.0000` (candidate summary identical to b1); `cloud/budget.py status` -> `spent $2.41 of $200.00`.
- Step 5: M5 commit `600e7f4bc85baff7f3550d7e738894ffa49dd7e5`; no ledger entries written, per task.

## Work done
- Claimed task 015 (this report created).
- Step 1: extracted diff block (lines 38-1167 of the task file) via `mktemp`+`sed`; `git apply --check` OK, `git apply` OK. New files: `judges/ems/emslearn/` (5 files), `ems_blue_bench_m5.py`, `ems_candidate_learned.py`, `ems_es.py`, `ems_red_bench_m5.py`, `ems_train.py`, `tests/test_emslearn.py`; modified: `cloud/ems_modal.py`, `scripts/ar_check.py`, `tests/test_ar_check.py`.
- Step 2: `.venv/bin/python -m pytest -q` -> 141 passed, 1 skipped; `.venv/bin/python scripts/name_guard.py` -> pass (rc=0); `.venv/bin/ruff check .` -> All checks passed.
- Step 4: smoke outputs above, all matching the task's expected values; bench run directory `judges/ems/runs/ar-blue-ems-m5/20261101-195857` (gitignored).

## Results
(none yet)

## Deviations
- Environment: reinstalled the editable package (`pip install -e . --no-deps --no-build-isolation`) after applying the patch so the new `emslearn` top-level package resolves in `.venv`. No repo files touched; needed for the step-2 counts.

## Blocked / questions
(none)
