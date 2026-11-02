# Report 017: Autoresearch blue + red loops: ems-no-cf (M5 arm NO_CF)
Status: in_progress
Branch head at start: 046361bd188129844560d03e6c7daa28e27b88db  ·  at finish: <pending>

## Summary
Blue iters 1-5 all reverted: ES from b1-linear (5-15 gens, 48-96 days/gen, moving
and fixed pools, small steps) lands at 1.0043-1.0140, never beating b1's 1.0000.
Linear argmax sees only 4 varying features and the hold weight is frozen at
never-hold, so ES tunes ~3 live dims around an apparent local optimum. Iter 6
KEPT: a hand-coded hold rule (hold tier-3 when idle < 3) scores 0.8439, -15.6%
vs b1. Verified no sim gaming (no abandonment; runs to horizon+12h). Red iter 1
reverted: max-stress thetas collapse regret to 114.33 (vs 500.25 nominal), so
saturation destroys the oracle edge; pool unchanged, no rebaseline. Next: tune
the hold rule, then ES-tune linear weights on top of it.

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

Red (`research/autoresearch/ems-no-cf-red/autoresearch.jsonl` on `ar/red/ems-no-cf`):

| iter | hypothesis | value | decision | seconds |
| 0 | baseline - nominal sampler against b1 candidate | 500.25 | baseline | 86 |
| 1 | max-stress theta on every knob | 114.33 | revert | 253 |

Spend so far (this arm, from `runs/spend.jsonl`): it01 $0.336, it02 $0.997,
it03 $1.336, it04 $1.324, it05 $0.530 (iters 6 free) = $4.52. Program total
$8.78 / $200 (stop above $150).

## Deviations
(none)

## Blocked / questions
(none)
