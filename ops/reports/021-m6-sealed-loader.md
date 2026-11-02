# Report 021: M6: sealed-data loader and confirm script (build and test only; no sealed run)
Status: in_progress
Branch head at start: 413c47aa5b37ca143f9d77cd1d92c8b16b4920d8  ·  at finish: <sha>

## Summary
TBD.

## Work done
- Claimed task 021.
- Built `judges/ems/scripts/confirm.py` (fetch_sealed w/ ledger gate, verify_sealed, sealed_day_tables via clean+day_table, pools_for, policies_for w/ seq-20 + EMS5-pin hash checks, check/run/dry-run CLI) and `judges/ems/tests/test_confirm.py` (11 unit tests, temp ledgers + fake opener only).
- `confirm.py check`: all green (22-entry chain, 5 preregs match, seq-20 hashes match, EMS5 pins verify, counts 96/93/1098/1098, no holdout_eval).

## Results
TBD.

## Deviations
None yet.

## Blocked / questions
None yet.
