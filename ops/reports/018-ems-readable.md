# Report 018: Autoresearch blue + red loops: ems-readable (M5 arm READABLE)
Status: in_progress
Branch head at start: 9a4b206  ·  at finish: TBD

## Summary
Arm READABLE in progress: 15/40 blue hypotheses and 3/10 red iterations done,
all committed and pushed per iteration. Blue best stays b1 at ratio_b1=1.0000
(all 15 reverted); red best is 650.56 (demand floor 0.9, kept at red #1).

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
- Journals committed on the blue branch at hyps 5, 10, 15.

## Results
Full per-iteration table at finish; current bests (from branch logs):
| loop | best iter | metric | value | commit |
|------|-----------|--------|-------|--------|
| red | 1 | regret_candidate (higher better) | 650.56 | 684c404 |
| blue | 0 | ratio_b1 (lower better) | 1.0000 | 861aab1 |

## Deviations
None yet.

## Blocked / questions
None yet.
