# Report 017: Autoresearch blue + red loops: ems-no-cf (M5 arm NO_CF)
Status: in_progress
Branch head at start: 046361bd188129844560d03e6c7daa28e27b88db  ·  at finish: <pending>

## Summary
Blue iters 1-5 all reverted: ES from b1-linear (5-15 gens, 48-96 days/gen, moving
and fixed pools, small steps) lands at 1.0043-1.0140, never beating b1's 1.0000.
Linear argmax sees only 4 varying features and the hold weight is frozen at
never-hold, so ES tunes ~3 live dims around an apparent local optimum. Iter 6
KEPT: a hand-coded hold rule (hold tier-3 when idle < 3) scores 0.8439, -15.6%
vs b1. Verified no sim gaming (no abandonment; runs to horizon+12h). Iter 7 kept
idle<5 (0.8208); iter 8 (idle<8, 0.8336) reverted. Red iter 1 reverted (max-stress
114.33: saturation destroys the oracle edge); red iter 2 KEPT concentrated-surge
thetas (regret 870.87, 165/200 days). Blue rebaselined on the new pool (0.8580).
Iters 10-11 reverted (idle<6: 0.8632; idle<4: 0.8658 — idle<5 stays optimal on
the new pool). Iter 12 KEPT: also hold tier-2 when idle<2 (0.8533), reserving
the last units for tier-1. Best is now 0.8533. Red #3 is due after blue 12.
Next: red #3, then ES-tune weights on top of the hold rule under the Amendment 1
envelope (≤3,000 scenario-days per iteration). Red #3 reverted: demand 1.25
under the same concentrated surge scores 717.07 (128/200 days), below the kept
870.87 — higher demand shrinks the oracle edge. Pool unchanged, no rebaseline.

## Work done
- Claimed task 017 on main (`9a4b206 Start task 017`, pushed).
- Setup blue (`66efe90` candidate, `0c36159` harness, pushed): worktree
  `ar/blue/ems-no-cf`, 1,095 cached days, `ems_candidate_learned.py` installed as
  `ems_candidate.py`, `autoresearch.{md,sh}`, empty jsonl. Suite: 141 passed,
  1 skipped; name guard clean.
- Setup red (`607871f` harness, pushed): worktree `ar/red/ems-no-cf`, nominal
  sampler untouched, `autoresearch.{md,sh}`, empty jsonl. Suite: 141 passed,
  1 skipped; name guard clean.
- Red baseline (`839cd8b`, pushed): `METRIC regret_candidate=500.25`, 86 s wall,
  run `runs/ar-red-ems-m5/20261101-202504` (72/200 days with regret; nominal pool).
- Blue baseline (`450af70`, pushed): `METRIC ratio_b1=1.0000`, 162 s wall, 100
  nominal + 100 nominal-pool days (red sampler still nominal).
- Blue #1 (`c510b3a`, pushed): revert, ES defaults 5 gens x 48 d -> 1.0043 (49 s).
- Blue #2 (`8b8c6d4`, pushed): revert, ES 15 gens x 48 d -> 1.0048 (32 s).
- Blue #3 (`3a08b26`, pushed): revert, ES 10 gens x 96 d -> 1.0089 (37 s).
- Blue #4 (`dd0cf68`, pushed): revert, fixed-pool ES (pool_seed 7) 10 gens x 96 d
  -> 1.0140 (55 s bench; 806 s train, Modal contention). Center oscillated on the
  fixed pool instead of descending.
- Red #1 (`c0e6952`, pushed): revert, max-stress theta -> 114.33 (253 s, 17/200
  days with regret). Saturation kills regret; pool unchanged, no blue rebaseline.
- Blue #5 (`d75a95d`, pushed): revert, fine ES near b1 (sigma 0.02, lr 0.01,
  8 gens) -> 1.0131 (60 s).
- Blue #6 (`36163af`, pushed): KEEP, hold tier-3 when idle<3 -> 0.8439 (71 s).
  New best. Keep checks pass (141 passed, 1 skipped; name guard clean). Journal
  note on branch (`a92ea1b`).
- Blue #7 (`1806fca`, pushed): KEEP, hold tier-3 when idle<5 -> 0.8208 (71 s).
- Blue #8 (`911d8d6`, pushed): revert, idle<8 -> 0.8336 (76 s). Over-holding.
- Red #2 (`0b54e5e`, pushed): KEEP, concentrated surge (demand 1.1, max
  concentration) -> regret 870.87 (197 s, 165/200 days). Keep checks pass.
  Unused-import cleanup folded into the kept sampler (pre-commit hook).
- Blue #9 (`cfdba40`, pushed): rebaseline after red #2 keep -> 0.8580 (116 s).
  New best on the new pool.
- Blue #10 (`157209a`, pushed): revert, idle<6 -> 0.8632 (79 s).
- Blue #11 (`103d051`, pushed): revert, idle<4 -> 0.8658 (118 s).
- Blue #12 (`a91c945`, pushed): KEEP, also hold tier-2 when idle<2 -> 0.8533
  (84 s). Keep checks pass (suite + name guard on the branch).

## Results
Blue (`research/autoresearch/ems-no-cf/autoresearch.jsonl` on `ar/blue/ems-no-cf`):

| iter | hypothesis | value | decision | seconds |
| 0 | baseline - learned candidate with no weights is exactly b1 | 1.0000 | baseline | 162 |
| 1 | ES defaults (5 gens, pairs 8, sigma 0.05, lr 0.05, days 48) from b1-linear | 1.0043 | revert | 49 |
| 2 | ES 15 generations from b1-linear | 1.0048 | revert | 32 |
| 3 | ES 10 gens x 96 days from b1-linear (less pool noise) | 1.0089 | revert | 37 |
| 4 | fixed-pool ES (pool_seed 7, 10 gens x 96 days) | 1.0140 | revert | 55 |
| 5 | fine-grained ES near b1 (sigma 0.02, lr 0.01, 8 gens) | 1.0131 | revert | 60 |
| 6 | hold tier-3 calls when fewer than 3 units idle | 0.8439 | keep | 71 |
| 7 | hold tier-3 more aggressively (idle<5) | 0.8208 | keep | 71 |
| 8 | hold tier-3 even more (idle<8) | 0.8336 | revert | 76 |
| 9 | rebaseline after red #2 keep; best unchanged | 0.8580 | rebaseline | 116 |
| 10 | hold threshold idle<6 refines the optimum on the new pool | 0.8632 | revert | 79 |
| 11 | hold threshold idle<4 refines the optimum on the new pool | 0.8658 | revert | 118 |
| 12 | hold tier-2 under deep shortage (idle<2), last units for tier-1 | 0.8533 | keep | 84 |

Red (`research/autoresearch/ems-no-cf-red/autoresearch.jsonl` on `ar/red/ems-no-cf`):

| iter | hypothesis | value | decision | seconds |
| 0 | baseline - nominal sampler against b1 candidate | 500.25 | baseline | 86 |
| 1 | max-stress theta on every knob | 114.33 | revert | 253 |
| 2 | concentrated spatial surge (max concentration, moderate demand) | 870.87 | keep | 197 |

Spend so far (this arm, from `runs/spend.jsonl`): it01 $0.336, it02 $0.997,
it03 $1.336, it04 $1.324, it05 $0.530 (iters 6 free) = $4.52. Program total
$8.78 / $200 (stop above $150).

## Deviations
(none)

## Blocked / questions
(none)
