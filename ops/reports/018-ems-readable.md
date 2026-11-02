# Report 018: Autoresearch blue + red loops: ems-readable (M5 arm READABLE)
Status: in_progress
Branch head at start: 9a4b206  ·  at finish: TBD

## Summary
Arm READABLE in progress: 28/40 blue hypotheses and 7/10 red iterations done,
all committed and pushed per iteration. Blue best is ratio_b1=0.9974
(relocation gate at 2 idle, 1/20 constants); red best is regret 785.82
(demand floor + conc max + urgent ceiling).

## Work done
- Claimed task 018 (this report created).
- Setup: worktrees `../cv-meta-hackathon-2026-ar-{blue,red}-ems-readable` on
  branches `ar/blue/ems-readable`, `ar/red/ems-readable` from main c4407c1.
  Day caches: 1,095 files in each worktree.
- Red baseline: `Autoresearch ems-readable-red #0` (6cf7bcb),
  regret_candidate=500.25, 72/200 days with regret, 195.5 s.
- Blue baseline: `Autoresearch ems-readable #0` (861aab1),
  ratio_b1=1.0000, pool_key 337fc936ef3f3d2d, 186 s.
- Blue hyps 1-15 (log iters 1-4, 6-16; #5 is a rebaseline at 1.0000 after
  red #1 changed the pool): all reverted. b1's three calibrated params are
  all bracketed (divert_queue 2: 4->1.1076, 1->4.0393; activate_queue 2:
  3->1.6166, 1->1.3683; activate_n 3: 4->1.0235, 2->1.0396). Structural tries
  (adaptive demand 1.0091, urgency dispatch 1.0193, proactive activation
  1.0003, coverage 600s 1.0078, 30-min relocation 1.0014, settled-unit
  preference 1.2797, fixed busy-p 1.0054, queue-aware positioning 1.0021,
  next-hour demand 1.0166) all reverted. Closest: proactive activation 1.0003.
- Red #1 kept (684c404): demand floor 0.9, regret 500.25->650.56 (pytest 141
  passed + name guard clean before the keep). Red #2 (urgent ceiling, 516.20)
  and #3 (unavailable ceiling, 579.82) reverted; pool unchanged since red #1.
- Journals committed on the blue branch at hyps 5, 10, 15, 20, 25 and on the
  red branch at red iter 5.
- Blue hyps 16-28: first keep at hyp 19 (relocation gate MIN_IDLE_RELOC=3,
  0.9990), hyp 22 kept (proactive activation at 1.5x, 0.9944), hyp 27 kept
  (ablated proactive on the urgent+conc pool, 0.9985), hyp 28 kept (gate 3->2,
  0.9974). Rebaselines #22 (0.9965) and #27 (1.0037) after red #4/#6 keeps.
  Current candidate: gate-only at 2 idle, 1/20 constants, best 0.9974.
- Red #4 kept (conc max, 733.52), #5 reverted (unavailable on conc, 697.27),
  #6 kept (urgent on conc, 785.82), #7 reverted (offload on corner, 623.58).
  Scheduling note: red #4/#5 ran together after blue hyp 20 (I ran hyps
  13-20 straight); cadence is restored (red #6 after hyp 24, #7 after hyp 28).

## Results
Full per-iteration table at finish; current bests (from branch logs):
| loop | best iter | metric | value | commit |
|------|-----------|--------|-------|--------|
| red | 6 | regret_candidate (higher better) | 785.82 | c015aa9 |
| blue | 31 | ratio_b1 (lower better) | 0.9974 | 5e66613 |

## Deviations
None yet.

## Blocked / questions
None yet.
