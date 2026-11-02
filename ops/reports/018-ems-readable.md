# Report 018: Autoresearch blue + red loops: ems-readable (M5 arm READABLE)
Status: done
Branch head at start: 9a4b206  ·  at finish: 02c4e87

## Summary
Arm READABLE finished all 40 blue hypotheses and 10 red iterations, every
iteration logged, committed and pushed. Blue best is ratio_b1=0.9933
(relocation gate at 2 idle + 30-min cadence, 2/20 hand-set constants, kept at
blue #43); on the final red pool it re-measures at 1.0097 (rebaseline #45).
Red best is regret 1207.57 (demand 1.05 + conc 104/3 + urgent ceiling +
unavailable ceiling, kept at red #10). Both loops audit clean
(`ar_check.py`: blue 46 entries 0 problems, red 11 entries 0 problems).
Spend added by this arm: $0 (no `emslearn`, no ES, no GPU per the arm rules).

## Work done
- Claimed task 018 (status in_progress, this report created; commit c4407c1).
- Setup: worktrees `../cv-meta-hackathon-2026-ar-{blue,red}-ems-readable` on
  branches `ar/blue/ems-readable`, `ar/red/ems-readable` from main c4407c1;
  day caches 1,095 files in each. `autoresearch.sh`/`.md`/`.jsonl` written per
  `skills/autoresearch/SKILL.md` Step 4 with exactly the task's benchmark
  commands ($BLUE/$RED defined in each script).
- Blue baseline #0 (861aab1): ratio_b1=1.0000 as expected, 186 s.
  Red baseline #0 (6cf7bcb): regret_candidate=500.25, 72/200 days, 195.5 s.
- Ran blue hyps 1-40 with one red iteration after every 4th blue hypothesis
  (reds #1-10), rebaselining blue after each kept red (#5, #22, #27, #36,
  #45). Every iteration: bench run -> log line -> commit -> push.
  Journal entries on the blue branch at hyps 5/10/15/20/25/30/35/40 and on
  the red branch at red iters 5/10.
- Kept: blue #20 (gate-3, 0.9990), #24 (proactive-1.5, 0.9944), #30 (ablate
  proactive, 0.9985), #31 (gate 3->2, 0.9974), #43 (30-min gated relocation,
  0.9933); red #1 (demand floor, 650.56), #4 (conc max, 733.52), #6 (urgent
  on conc, 785.82), #8 (unavailable corner, 861.45), #10 (demand 1.05,
  1207.57). pytest (141 passed, 1 skipped) + name guard clean before every
  keep. All other iterations reverted (tables below).
- Audits (output pasted in Results): blue `46 entries, 0 problems`, red
  `11 entries, 0 problems`. Branches pushed (blue b6d42ca, red da04a94),
  not merged. No ledger entries (dev loop; nothing here is a finding).

## Results
Best kept values (from the branch logs; `ar_check.py` verified the rules):
| loop | best | metric | value | keep commit | final files |
|------|------|--------|-------|-------------|-------------|
| blue | #43 | ratio_b1 (lower better) | 0.9933 | cdfe8e4 | `judges/ems/experiments/ar/ems_candidate.py` on `ar/blue/ems-readable` (gate-2 + 30-min cadence, 2/20 constants) |
| blue | #45 | ratio_b1 on final pool | 1.0097 | 9215fd8 | rebaseline after red #10 (same candidate) |
| red | #10 | regret_candidate (higher better) | 1207.57 | d49ba3c | `judges/ems/experiments/ar/ems_red_sampler.py` on `ar/red/ems-readable` (demand 1.05, conc 104/3, urgent 1.153, unavail 0.25) |

Blue iterations (hypothesis abbreviated; full text in
`research/autoresearch/ems-readable/autoresearch.jsonl` on `ar/blue/ems-readable`):
| iter | hyp | value | decision | s | hypothesis |
|------|-----|-------|----------|---|------------|
| 0 | - | 1.0000 | baseline | 186 | unchanged baseline |
| 1 | 1 | 1.1076 | revert | 84 | divert less (divert_queue 2->4) |
| 2 | 2 | 4.0393 | revert | 81 | divert more (divert_queue 2->1) |
| 3 | 3 | 1.0091 | revert | 60 | adaptive demand (last-hour volume, clamp 0.5-2.0) |
| 4 | 4 | 1.0193 | revert | 59 | weighted-urgency dispatch |
| 5 | - | 1.0000 | rebaseline | 82 | red #1 kept; re-measure unchanged best |
| 6 | 5 | 1.0235 | revert | 53 | activate_n 3->4 |
| 7 | 6 | 1.6166 | revert | 61 | activate_queue 2->3 |
| 8 | 7 | 1.3683 | revert | 77 | activate_queue 2->1 |
| 9 | 8 | 1.0003 | revert | 60 | proactive activation at 1.5x volume |
| 10 | 9 | 1.0078 | revert | 57 | coverage 480s->600s |
| 11 | 10 | 1.0014 | revert | 52 | relocate every 30 min |
| 12 | 11 | 1.2797 | revert | 57 | prefer settled units in assignment |
| 13 | 12 | 1.0054 | revert | 56 | fixed busy-p 0.5 |
| 14 | 13 | 1.0021 | revert | 58 | queue-aware positioning (QUEUE_W=1.0) |
| 15 | 14 | 1.0396 | revert | 84 | activate_n 3->2 |
| 16 | 15 | 1.0166 | revert | 202 | next-hour demand positioning |
| 17 | 16 | 1.2887 | revert | 59 | queue-scaled activation (1 below q4, else 3) |
| 18 | 17 | 1.0188 | revert | 60 | coverage-preserving assignment |
| 19 | 18 | 1.0175 | revert | 67 | demand-uniform blend 0.7/0.3 |
| 20 | 19 | 0.9990 | keep | 91 | relocation gate (skip if <3 idle) |
| 21 | 20 | 0.9995 | revert | 56 | gate 3->5 |
| 22 | - | 0.9965 | rebaseline | 137 | red #4 kept; re-measure unchanged best |
| 23 | 21 | 0.9973 | revert | 192 | gate 3->2 |
| 24 | 22 | 0.9944 | keep | 111 | proactive 1.5x on gated base |
| 25 | 23 | 1.0106 | revert | 126 | proactive 1.5->2.0 |
| 26 | 24 | 1.0117 | revert | 208 | proactive 1.5->1.25 |
| 27 | - | 1.0037 | rebaseline | 87 | red #6 kept; re-measure unchanged best |
| 28 | 25 | 1.0125 | revert | 72 | proactive 1.5->2.0 on urgent+conc pool |
| 29 | 26 | 1.0169 | revert | 88 | queue-aware retry on urgent+conc pool |
| 30 | 27 | 0.9985 | keep | 91 | ablate proactive (gate-only) |
| 31 | 28 | 0.9974 | keep | 58 | gate 3->2 on urgent+conc pool |
| 32 | 29 | 0.9995 | revert | 78 | coverage 480s->360s |
| 33 | 30 | 1.0047 | revert | 94 | volume-gated early activation |
| 34 | 31 | 1.0097 | revert | 191 | lone-unit relocation preference |
| 35 | 32 | 1.0001 | revert | 82 | urgent-only queue positioning |
| 36 | - | 0.9950 | rebaseline | 126 | red #8 kept; re-measure unchanged best |
| 37 | 33 | 1.0007 | revert | 67 | fixed busy-p 0.3 |
| 38 | 34 | 1.0149 | revert | 90 | half-hour activation guard |
| 39 | 35 | 1.0353 | revert | 89 | activate_n 3->4 on thin-fleet pool |
| 40 | 36 | 1.0190 | revert | 67 | divert only when urgent waits |
| 41 | 37 | 1.2115 | revert | 125 | tier-3 takes 2nd-nearest unit |
| 42 | 38 | 0.9989 | revert | 108 | gate 2->4 on full-corner pool |
| 43 | 39 | 0.9933 | keep | 70 | 30-min gated relocation (RELOC_S=1800) |
| 44 | 40 | 0.9938 | revert | 95 | 15-min cadence (RELOC_S 1800->900) |
| 45 | - | 1.0097 | rebaseline | 135 | red #10 kept; re-measure unchanged best |

Red iterations (full text in
`research/autoresearch/ems-readable-red/autoresearch.jsonl` on `ar/red/ems-readable`):
| iter | value | decision | s | hypothesis |
|------|-------|----------|---|------------|
| 0 | 500.25 | baseline | 195.5 | unchanged baseline (nominal sampler) |
| 1 | 650.56 | keep | 71 | demand floor 0.9 |
| 2 | 516.20 | revert | 71 | urgent ceiling 1.153 |
| 3 | 579.82 | revert | 56 | unavailable ceiling 0.25 |
| 4 | 733.52 | keep | 119 | conc max (104 calls / 3 zips) |
| 5 | 697.27 | revert | 93 | unavailable on conc max |
| 6 | 785.82 | keep | 118 | urgent ceiling on conc max |
| 7 | 623.58 | revert | 74 | offload ceiling on corner |
| 8 | 861.45 | keep | 111 | unavailable on the full corner |
| 9 | 688.52 | revert | 99 | tighter spike (104 calls / 1 zip) |
| 10 | 1207.57 | keep | 89 | demand 0.9->1.05 on the corner (load 1.40) |

Audits (commands from the task; run in each worktree):
- blue: `46 entries, 0 problems` (rc=0)
- red: `11 entries, 0 problems` (rc=0)

Spend added by this arm: $0.00. No `emslearn.cli` calls, no `ems_es.py`, no
GPU (arm READABLE forbids them); every `emslearn` command used, in order:
(none). (`cloud/budget.py status` shows $11.00 total across all arms, other
sessions' Modal usage, under the $150 gate.)

Skill friction:
- `skills/autoresearch/SKILL.md` says nothing about red-side rebaselines when
  blue improves mid-loop; red #4+ compare numerically against a bar measured
  vs an older candidate (bias ~0.1% here; noted, loop rule followed literally).
- The skill's commit/evidence conventions assume one loop per branch; the
  interleaved rebaseline entries needed a message convention I chose
  (`#N: rebaseline - ...`; `ar_check.py` does not check messages).
- The shell ran `sh` (dash), not bash: `${PIPESTATUS[0]}` fails. All timed
  runs here used plain redirect + `$?` instead.

## Deviations
- Red #4/#5 ran back-to-back after blue hyp 20 (I ran hyps 13-20 straight
  before noticing); cadence restored after (red #6 after hyp 24, #7 after 28,
  #8 after 32, #9 after 36, #10 after 40). Pairing intact: 10 reds for 40
  blue hyps; each kept red immediately followed by its blue rebaseline.
- One transient `git push` failure (SSL connection timeout); the next push
  covered the same commits. All branches verified in sync with origin.
- Blue #11's `surge` rebuild and hyp #4/#10/#11/#12/#16/#17/#19/#31 copies of
  `Classical.act` duplicate b1 logic to change one mechanism; the final kept
  candidate keeps that structure (readable, 2 constants, no behavior drift:
  every value came from its own benchmark run).

## Blocked / questions
None. Reviewer: hash the final candidate
(`ar/blue/ems-readable@cdfe8e4:judges/ems/experiments/ar/ems_candidate.py`)
into a `protocol_note` per the task. Nothing from this loop is a finding.
