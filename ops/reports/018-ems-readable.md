# Report 018: Autoresearch blue + red loops: ems-readable (M5 arm READABLE)
Status: in_progress
Branch head at start: 9a4b206  ·  at finish: TBD

## Summary
Arm READABLE setup done: blue/red worktrees created, day caches verified
(1,095 files each), both baselines logged and pushed. Blue #0 ratio_b1=1.0000
(expected); red #0 regret_candidate=500.25 against b1.

## Work done
- Claimed task 018 (this report created).
- Setup: worktrees `../cv-meta-hackathon-2026-ar-{blue,red}-ems-readable` on
  branches `ar/blue/ems-readable`, `ar/red/ems-readable` from main c4407c1.
  Day caches: 1,095 files in each worktree.
- Red baseline: `Autoresearch ems-readable-red #0` (6cf7bcb),
  regret_candidate=500.25, 72/200 days with regret, 195.5 s.
- Blue baseline: `Autoresearch ems-readable #0` (861aab1),
  ratio_b1=1.0000, pool_key 337fc936ef3f3d2d, 186 s.

## Results
| loop | iter | metric | value | commit |
|------|------|--------|-------|--------|
| red | 0 | regret_candidate (higher better) | 500.25 | 6cf7bcb |
| blue | 0 | ratio_b1 (lower better) | 1.0000 | 861aab1 |

## Deviations
None yet.

## Blocked / questions
None yet.
