# Report 002: Scale CAGES (evacuation) to v0, pick the label horizon, train the E3 backbones, dev selection and edge latency
Status: in_progress
Branch head at start: 0d0ccd1db4a3d3f087fecd5cd757b6da9a9d1c67  ·  at finish: TBD

## Summary
Prerequisites pass; Part A done. `scripts/extract_laya_encoder.py` rebuilds `runs/laya-encoder` byte-identically (170 tensors, 394,781,696 params, sha256 `0c31065b…`) from `convaiinnovations/laya` at revision `7b928d82…`. Part B done (ledger seq 8, chain verifies). Parts C–F not yet started.

## Work done
- Claimed task 002: set `status: in_progress`, created this report.
- Prerequisite: ledger seq 7 is `evaluator_update` with `eval_version 2.0`; `pytest -q` → 43 passed, 1 skipped. Read README, results, journal 2026-10-28 entry, runbook-gpu, E3 draft.
- Part A: wrote `scripts/extract_laya_encoder.py` (pinned revision `7b928d828b7b0e022f929d9bd2e44165aa270148`, verified as current Hub main); rebuilt into `/tmp/laya-rebuild`; compared against `runs/laya-encoder`: same names/shapes/dtypes/values, identical config, identical file sha256. No differences.
- Part B: `ledger_commit(kind="protocol_note")` → seq 8 (`24a3d8c7…`), fixing the label-horizon rule, the six E3 arms, the dev-selection rule and the edge gate before any Part C–F result exists. `Ledger().verify()` → True.

## Results
None yet.

## Deviations
None.

## Blocked / questions
None.
