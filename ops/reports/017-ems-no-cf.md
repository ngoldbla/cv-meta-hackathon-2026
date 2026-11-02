# Report 017: Autoresearch blue + red loops: ems-no-cf (M5 arm NO_CF)
Status: done
Branch head at start: 046361bd188129844560d03e6c7daa28e27b88db  ·  at finish: bb10aa8f5ad7699170f16749c139866edaa15788

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
envelope (≤3,000 scenario-days per iteration). Red #3 reverted (demand 1.25:
717.07, 128/200 days). Blue #13: first envelope ES (pairs 8, days 24, gens 7 =
2,856 scenario-days, seed 13) on top of the hold rule reverted (0.8668 vs
0.8533). Blue #14-15 KEPT (tier-2 hold idle<3: 0.8459; idle<4: 0.8342); #16
reverted (idle<5: 0.8417, over-holding). Red #4 KEPT max urgent share 1.153
(regret 916.32, 168/200 days); blue #17 rebaselined on the new pool (0.8375).
Best is now 0.8375. Blue #18-19 reverted (tier-3 idle<6: 0.8500; 10-min
waited escape: 0.8382 near-tie). Blue #20 reverted: fine ES (sigma 0.02, lr
0.01, seed 20, 2,856 scenario-days) on the rule -> 0.8732. Red #5 reverted
(max offload: 557.68, 131/200 days); pool unchanged. The hold rule (tier-3
idle<5, tier-2 idle<4) looks like a stable optimum. Blue #21-24 reverted in
new dimensions: same-borough bonus 0.8537, queue-gated tier-3 hold 0.8396,
busy-hours hold gate 0.8394, tier-1-only same-borough bonus 0.8406. Red #6
reverted (10% unavailable: 305.07, 78/200 days — saturation kills the edge);
pool unchanged. Best stays 0.8375. Blue #25 reverted (16-pair fine ES, 2,772
scenario-days: 0.8430); #26 reverted (tier-3 moving-unit bonus: 0.8473); #27
reverted (16-gen fine ES, 2,880 scenario-days: 0.8872, drifted). Blue #28 KEPT:
tier-2 waited escape at 10 min -> 0.8371 (deterministic bench, keep checks
pass). Red #7 reverted (single-zip surge: 854.63, 154/200 days); pool
unchanged. Best is now 0.8371. Blue #29 KEPT tier-2 escape at 5 min (0.8324);
#30 reverted dropping the tier-2 hold (0.8585 — the single 5-min hold cycle is
load-bearing). Blue #31 KEPT tier-3 escape at 5 min (0.8249); #32 reverted
tier-3 idle<6 with escape (0.8489). Red #8 reverted (nominal demand: 717.12,
176/200 days); pool unchanged. Best is now 0.8249. Blue #33-35 re-bracketed
thresholds with escapes, all reverted: tier-2 idle<5 (0.8410), tier-3 idle<4
(0.8482), tier-2 idle<3 (0.8498). Blue #36 reverted (ES on the escaped rule:
0.8785). Red #9 reverted (two-zip surge: 797.19). Blue #37-40 reverted
(asymmetric escape 0.8314, tier-1 stationed bonus 0.8282, queue/busy-hours
gates with escapes 0.8396/0.8471). Red #10 reverted (nominal offload: 869.70).
Both loops at cap. Final best: blue 0.8249 (#31), red 916.32 (#4). ar_check:
blue 41 entries 0 problems, red 11 entries 0 problems. Branches pushed, not
merged; no ledger entries. Dev only — nothing here is a finding.

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
- Red #3 (`b30f912`, pushed): revert, demand 1.25 -> 717.07 (133 s, 128/200
  days). Pool unchanged, no blue rebaseline.
- Blue #13 (`27e7a1d`, pushed): revert, envelope ES (pairs 8, days 24, gens 7,
  seed 13; 2,856 scenario-days, 233 s train) on the hold rule -> 0.8668 (47 s).
- Blue #14 (`12ef5b9`, pushed): KEEP, tier-2 hold idle<3 -> 0.8459 (72 s).
  Keep checks pass. Follow-up `5e7001b` fixes a transcribed commit SHA in the
  log line. Journal `c203e87` covers iters 7-14.
- Blue #15 (`d027320`, pushed): KEEP, tier-2 hold idle<4 -> 0.8342 (104 s).
  Keep checks pass.
- Blue #16 (`7daa605`, pushed): revert, tier-2 hold idle<5 -> 0.8417 (47 s).
- Red #4 (`1faeb94`, pushed): KEEP, max urgent share 1.153 -> regret 916.32
  (171 s, 168/200 days). Keep checks pass.
- Blue #17 (`096f551`, pushed): rebaseline after red #4 keep -> 0.8375 (100 s).
- Blue #18 (`fb61fd2`, pushed): revert, tier-3 hold idle<6 -> 0.8500 (41 s).
- Blue #19 (`71cf236`, pushed): revert, tier-3 waited escape 10 min -> 0.8382
  (67 s).
- Blue #20 (`5141a34`, pushed): revert, fine ES (sigma 0.02, lr 0.01, seed 20;
  2,856 scenario-days, 234 s train) -> 0.8732 (81 s). Journal `6d8c78b` covers
  iters 15-20.
- Red #5 (`b803234`, pushed): revert, max offload 1.151 -> 557.68 (159 s,
  131/200 days). Pool unchanged, no blue rebaseline.
- Blue #21 (`19a81c8`, pushed): revert, same-borough bonus 0.1 -> 0.8537
  (55 s).
- Blue #22 (`6ed60b2`, pushed): revert, queue-gated tier-3 hold -> 0.8396
  (62 s).
- Blue #23 (`94f2dd4`, pushed): revert, busy-hours hold gate -> 0.8394 (71 s).
- Blue #24 (`a540ec3`, pushed): revert, tier-1 same-borough bonus -> 0.8406
  (50 s).
- Red #6 (`93b21a6`, pushed): revert, 10% unavailable -> 305.07 (120 s, 78/200
  days). Pool unchanged, no blue rebaseline.
- Blue #25 (`e706ec5`, pushed): revert, 16-pair fine ES (days 12, gens 7, seed
  25; 2,772 scenario-days, 230 s train) -> 0.8430 (42 s). Journal `95de895`
  covers iters 21-25.
- Blue #26 (`b3b8ea7`, pushed): revert, tier-3 moving-unit bonus -> 0.8473
  (40 s).
- Blue #27 (`21890dd`, pushed): revert, 16-gen fine ES (pairs 4, days 20, seed
  27; 2,880 scenario-days, 247 s train) -> 0.8872 (40 s).
- Blue #28 (`aff7dc0`, pushed): KEEP, tier-2 waited escape 10 min -> 0.8371
  (53 s). Keep checks pass.
- Red #7 (`049643c`, pushed): revert, single-zip surge -> 854.63 (135 s,
  154/200 days). Pool unchanged, no blue rebaseline.
- Blue #29 (`26a5357`, pushed): KEEP, tier-2 escape 5 min -> 0.8324 (41 s).
  Keep checks pass.
- Blue #30 (`47b87f1`, pushed): revert, drop tier-2 hold -> 0.8585 (42 s).
  Journal `a5a442b` covers iters 26-30.
- Blue #31 (`9d27f70`, pushed): KEEP, tier-3 escape 5 min -> 0.8249 (39 s).
  Keep checks pass.
- Blue #32 (`538dbf9`, pushed): revert, tier-3 idle<6 with escape -> 0.8489
  (75 s).
- Red #8 (`2705c43`, pushed): revert, nominal demand 1.0 -> 717.12 (110 s,
  176/200 days). Pool unchanged, no blue rebaseline.
- Blue #33 (`c6afc06`, pushed): revert, tier-2 idle<5 with escape -> 0.8410
  (40 s).
- Blue #34 (`56f6ebe`, pushed): revert, tier-3 idle<4 with escape -> 0.8482
  (39 s).
- Blue #35 (`5f151dd`, pushed): revert, tier-2 idle<3 with escape -> 0.8498
  (40 s). Journal `c181915` covers iters 31-35.
- Blue #36 (`1767170`, pushed): revert, ES (pairs 8, days 24, gens 7, seed 36;
  2,856 scenario-days, 400 s train under contention) on the escaped rule ->
  0.8785 (42 s).
- Red #9 (`53d2655`, pushed): revert, two-zip surge -> 797.19 (178 s, 166/200
  days). Pool unchanged, no blue rebaseline.
- Blue #37 (`624b7a3`, pushed): revert, tier-3 escape 10 min (tier-2 5 min) ->
  0.8314 (45 s).
- Blue #38 (`c7b9997`, pushed): revert, tier-1 stationed-unit bonus -> 0.8282
  (43 s).
- Blue #39 (`c3fd5e5`, pushed): revert, queue gate with escape -> 0.8396
  (39 s).
- Blue #40 (`5321552`, pushed): revert, busy-hours gate with escape -> 0.8471
  (67 s). Blue at the 40-iteration cap. Journal `46df86d` covers iters 36-40.
- Red #10 (`fc486c9`, pushed): revert, nominal offload 1.0 -> 869.70 (140 s,
  173/200 days). Red at the 10-iteration cap. Pool unchanged.
- Audits (past verbatim below): blue `41 entries, 0 problems`, red
  `11 entries, 0 problems`. Both branches pushed, not merged.

## Results
Blue (`research/autoresearch/ems-no-cf/autoresearch.jsonl` on `ar/blue/ems-no-cf`):

| iter | hypothesis | value | decision | seconds | pairs | days | gens |
| 0 | baseline - learned candidate with no weights is exactly b1 | 1.0000 | baseline | 162 | — | — | — |
| 1 | ES defaults (5 gens, pairs 8, sigma 0.05, lr 0.05, days 48) from b1-linear | 1.0043 | revert | 49 | 8 | 48 | 5 |
| 2 | ES 15 generations from b1-linear | 1.0048 | revert | 32 | 8 | 48 | 15 |
| 3 | ES 10 gens x 96 days from b1-linear (less pool noise) | 1.0089 | revert | 37 | 8 | 96 | 10 |
| 4 | fixed-pool ES (pool_seed 7, 10 gens x 96 days) | 1.0140 | revert | 55 | 8 | 96 | 10 |
| 5 | fine-grained ES near b1 (sigma 0.02, lr 0.01, 8 gens) | 1.0131 | revert | 60 | 8 | 48 | 8 |
| 6 | hold tier-3 calls when fewer than 3 units idle | 0.8439 | keep | 71 | — | — | — |
| 7 | hold tier-3 more aggressively (idle<5) | 0.8208 | keep | 71 | — | — | — |
| 8 | hold tier-3 even more (idle<8) | 0.8336 | revert | 76 | — | — | — |
| 9 | rebaseline after red #2 keep; best unchanged | 0.8580 | rebaseline | 116 | — | — | — |
| 10 | hold threshold idle<6 refines the optimum on the new pool | 0.8632 | revert | 79 | — | — | — |
| 11 | hold threshold idle<4 refines the optimum on the new pool | 0.8658 | revert | 118 | — | — | — |
| 12 | hold tier-2 under deep shortage (idle<2), last units for tier-1 | 0.8533 | keep | 84 | — | — | — |
| 13 | ES on the hold rule (seed 13; 2,856 scenario-days) | 0.8668 | revert | 47 | 8 | 24 | 7 |
| 14 | hold tier-2 more aggressively (idle<3) | 0.8459 | keep | 72 | — | — | — |
| 15 | hold tier-2 more aggressively (idle<4) | 0.8342 | keep | 104 | — | — | — |
| 16 | hold tier-2 at idle<5 (match tier-3 threshold) | 0.8417 | revert | 47 | — | — | — |
| 17 | rebaseline after red #4 keep; best unchanged | 0.8375 | rebaseline | 100 | — | — | — |
| 18 | wider tier-3 hold (idle<6) on the urgent-heavy pool | 0.8500 | revert | 41 | — | — | — |
| 19 | tier-3 hold escapes after 10 min waited | 0.8382 | revert | 67 | — | — | — |
| 20 | fine ES on the hold rule (sigma 0.02, lr 0.01, seed 20) | 0.8732 | revert | 81 | 8 | 24 | 7 |
| 21 | same-borough bonus (0.1) in unit choice | 0.8537 | revert | 55 | — | — | — |
| 22 | tier-3 hold only when queue>=3 | 0.8396 | revert | 62 | — | — | — |
| 23 | hold rule only during busy hours (06-24h) | 0.8394 | revert | 71 | — | — | — |
| 24 | tier-1-only same-borough bonus (0.1) | 0.8406 | revert | 50 | — | — | — |
| 25 | fine ES with more pairs (16, days 12, seed 25) | 0.8430 | revert | 42 | 16 | 12 | 7 |
| 26 | tier-3-only moving-unit bonus (0.1) | 0.8473 | revert | 40 | — | — | — |
| 27 | long-horizon fine ES (pairs 4, days 20, gens 16, seed 27) | 0.8872 | revert | 40 | 4 | 20 | 16 |
| 28 | tier-2 hold escapes after 10 min waited | 0.8371 | keep | 53 | — | — | — |
| 29 | tier-2 hold escapes after 5 min waited | 0.8324 | keep | 41 | — | — | — |
| 30 | drop the tier-2 hold entirely | 0.8585 | revert | 42 | — | — | — |
| 31 | tier-3 hold escapes after 5 min waited | 0.8249 | keep | 39 | — | — | — |
| 32 | wider tier-3 hold (idle<6) with the escape | 0.8489 | revert | 75 | — | — | — |
| 33 | wider tier-2 hold (idle<5) with the escape | 0.8410 | revert | 40 | — | — | — |
| 34 | narrower tier-3 hold (idle<4) with the escape | 0.8482 | revert | 39 | — | — | — |
| 35 | narrower tier-2 hold (idle<3) with the escape | 0.8498 | revert | 40 | — | — | — |
| 36 | ES on the escaped rule (seed 36; 2,856 scenario-days) | 0.8785 | revert | 42 | 8 | 24 | 7 |
| 37 | tier-3 escape 10 min, tier-2 escape 5 min | 0.8314 | revert | 45 | — | — | — |
| 38 | tier-1 stationed-unit bonus (0.1) | 0.8282 | revert | 43 | — | — | — |
| 39 | tier-3 queue gate (queue>=3) with the escape | 0.8396 | revert | 39 | — | — | — |
| 40 | busy-hours hold gate with the escape | 0.8471 | revert | 67 | — | — | — |

Best kept blue value: **0.8249** at `9d27f707fc2b5dd35160ebd95b42f09c8d181ea2`
(`Autoresearch ems-no-cf #31: keep - tier-3 escape 5min`), branch
`ar/blue/ems-no-cf` (head `46df86d`, pushed, not merged). The kept candidate is
hand-coded (hold tier-3 when idle<5, tier-2 when idle<4, both escaping after 5
min waited; nearest-unit choice); no `.npz` weights are kept — every ES run
reverted. 8 keeps, 30 reverts, 2 rebaselines in 40 iterations.
Best kept red value: **916.32** at `1faeb9418ece9565521c294b5ae2bc71610828fd`
(`Autoresearch ems-no-cf-red #4: keep - max urgent share`), branch
`ar/red/ems-no-cf` (head `fc486c9`, pushed, not merged). 2 keeps, 8 reverts in
10 iterations.

Red (`research/autoresearch/ems-no-cf-red/autoresearch.jsonl` on `ar/red/ems-no-cf`):

| iter | hypothesis | value | decision | seconds |
| 0 | baseline - nominal sampler against b1 candidate | 500.25 | baseline | 86 |
| 1 | max-stress theta on every knob | 114.33 | revert | 253 |
| 2 | concentrated spatial surge (max concentration, moderate demand) | 870.87 | keep | 197 |
| 3 | higher demand (1.25) under the same concentrated surge | 717.07 | revert | 133 |
| 4 | maximum urgent share (1.153) under the concentrated surge | 916.32 | keep | 171 |
| 5 | maximum offload (1.151) under the urgent concentrated surge | 557.68 | revert | 159 |
| 6 | 10% unavailable fleet under the urgent concentrated surge | 305.07 | revert | 120 |
| 7 | surge tightened to a single zip | 854.63 | revert | 135 |
| 8 | nominal demand (1.0) with max urgent share | 717.12 | revert | 110 |
| 9 | surge over two zips | 797.19 | revert | 178 |
| 10 | nominal offload (1.0) with max urgent share | 869.70 | revert | 140 |

Spend by this arm (from `runs/spend.jsonl`): it01 $0.336, it02 $0.997, it03
$1.336, it04 $1.324, it05 $0.530, it13 $0.254, it20 $0.255, it25 $0.248, it27
$0.251, it36 $0.257 (all other iters free) = $5.79. Program total $12.56 /
$200 (stop above $150).

ES commands used, in order (all from the blue worktree's `judges/ems` with the
task's `PYTHONPATH`, `--candidate experiments/ar/ems_candidate.py
--pool-generator $RED/judges/ems/experiments/ar/ems_red_sampler.py`):
iters 1-5 per the logged hypotheses (defaults 8/48/5; 15 gens; 10x96; fixed
pool_seed 7, 10x96; sigma 0.02 lr 0.01, 8 gens — see `it01..it05.es.log` on
`ar/blue/ems-no-cf`); it13 `--args '{"generations": 7, "days": 24, "pairs": 8,
"seed": 13}'` (2,856 scenario-days); it20 same shape with `"seed": 20,
"sigma": 0.02, "lr": 0.01`; it25 `{"generations": 7, "days": 12, "pairs": 16,
"seed": 25, "sigma": 0.02, "lr": 0.01}` (2,772); it27 `{"generations": 16,
"days": 20, "pairs": 4, "seed": 27, "sigma": 0.02, "lr": 0.01}` (2,880); it36
`{"generations": 7, "days": 24, "pairs": 8, "seed": 36}` (2,856). Every
post-Amendment ES run is within the 3,000 scenario-day envelope. No `gen`,
`train`, counterfactual-report or `dev_eval.json` access in this arm, per the
arm rules.

`ar_check` output (blue, in the blue worktree):

```text
41 entries, 0 problems
```

`ar_check` output (red, in the red worktree):

```text
11 entries, 0 problems
```

## Deviations
- Blue #14's log line first recorded a mistranscribed commit SHA (typed from
  memory instead of captured from `git rev-parse`); fixed by follow-up commit
  `5e7001b` on `ar/blue/ems-no-cf`, which touches only the jsonl line. All
  later iterations capture `HEAD` in-shell. `ar_check` passes.
- Both worktree branches lost their upstream tracking at the Amendment 1
  cutover, so the first push of this session on each needed `git push -u
  origin <branch>`; later pushes were plain `git push`.
- Blue #36's ES train took 400 s (vs ~230 s for the same shape) under shared
  Modal contention with the other arms; no flags changed.

Friction with the skill text: none in the loop mechanics. The inbox
`git pull --no-rebase` before each main push occasionally fast-forwards past
the other arms' report commits; no conflicts occurred.

## Blocked / questions
(none — no model choices, pre-registrations, or approvals needed. Per the task,
the reviewer hashes the final candidate into a `protocol_note`.)
