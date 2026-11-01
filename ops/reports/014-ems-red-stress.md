# Report 014: Autoresearch red loop: ems-stress
Status: in_progress
Branch head at start: 82b3634d1546019807fa5877ffedb5b22ad0e541  ·  at finish: TBD

## Summary
Red loop initialized in worktree on branch `ar/red/ems-stress`; baseline matches the expected value.

## Work done
- Claimed task 014 on main.
- Created worktree via `bash scripts/ar_worktree.sh red ems-stress`; cache holds 1,095 day files.
- Wrote `research/autoresearch/ems-stress/{autoresearch.md,autoresearch.sh,autoresearch.jsonl}`; ran baseline #0: `regret_b1=500.25` in 62 s (commit `3b093ca` on `ar/red/ems-stress`, pushed).
- Iterations 1-5: #1 max concentration 491.75 (revert); #2 crash (missing import); #3 max demand load 142.37 (revert); #4 max load via unavailability 682.39 (keep); #5 +max urgent share 694.06 (keep, commit `daffe8b`). Journal updated; branch pushed.
- Iterations 6-10: #6 max offload 597.59 (revert); #7 no concentration 638.31 (revert); #8 min offload 598.67 (revert); #9 interior load (u=0.125) 93.13 (revert); #10 demand 1.0 with thin staffing 733.07 (keep, commit `41070ac`; pre-commit hook caught an unused import, fixed). Journal updated; branch pushed.
- Iterations 11-15: #11 min demand 639.42 (revert); #12 fixed-moderate concentration 594.87 (revert); #13 weekend/holiday demand bump 815.11 (keep); #14 +low-volume-month bump 866.21 (keep, commit `48a4b51`); #15 summer ease 859.87 (revert). Volume analysis grounded date hypotheses (weekends/holidays -7%). Journal updated; branch pushed.

## Results
TBD.

## Deviations
None yet.

## Blocked / questions
None yet.
