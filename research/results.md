# Results

All results here are **exploratory (dev split)** unless marked *confirmatory*. Confirmatory results come only from `eval_holdout` runs recorded in `research/ledger.jsonl`. None have been run.

The project pivoted from elevators to subway and bus evacuation on 2026-10-28 (ledger entry 5). The elevator hypotheses H1–H3 were withdrawn before any holdout run, and the elevator-phase results are in git history (last elevator commit `5b9ee7e`). The transit hypotheses E1–E3 are drafted in `research/prereg/drafts/` and are not yet in the ledger.

## Validation of the instrument
Source: `tests/`. All pass, run against the v2.0 frozen files via `maintainer/overlay.sh`.

| Check | Result |
|---|---|
| Empty-line run times vs MTA GTFS (7 line, 22 stations) | each stop-to-stop time within 1 s of the schedule, or of the kinematic floor where the 30 s-resolution schedule is tighter than 1.12 / 1.34 m/s² allows; total within 3% (`test_empty_line_reproduces_gtfs_run_times`) |
| One train per signal block, no overtaking, including express runs | enforced on every resource take (`test_one_train_per_block_and_no_overtaking`) |
| Dwell grows with boarding load | 600 boarders over 33 doors add the predicted 13 s (`test_dwell_grows_with_boarding_load`) |
| Each failure mode W1, W2, W4, W6, W9 produces its effect | yes (`test_each_failure_mode_has_its_effect`) |
| A clone at a decision replays the original run exactly | yes (`test_clone_reproduces_the_run_exactly`) |
| Counterfactual labels vs independent brute-force replay | exact match (`test_counterfactual_labels_match_brute_force_replay`) |
| Crowd speed vs Weidmann | RMSE < 0.12 m/s (`test_social_force_matches_weidmann`) |
| Anchors: R188 capacity, GTFS run times, observed Mets–Willets Point peak entries, Citi Field capacity and Green Guide egress time, bus capacity, bottleneck flow | enforced (`tests/test_anchors.py`); NFPA 130 is a reference metric only |

## CAGES v0-mini (evacuation)
Source: `datasets/cages-v0-mini/` (ledger entry 6).
- **Size:** 60 train and 15 dev instances, giving **419 / 153** labelled alerts. Labels use K=4 CRN rollouts and a 900 s horizon.
- **Which choice is counterfactually best:**
  - "no action" in 51% of train alerts (63% dev);
  - the rolling-horizon planner picks the best slot in 67% (65%);
  - the express rule in 38% (43%).
- **Label informativeness:** the median gap between the best and worst slot is 5% of cost (dev 4%), against about 1% in the elevator labels.

## Decision model: tiny CPU run
Source: `experiments/results/seed-evac-scratch-metrics.json`. Scratch transformer, 0.86M parameters, 40 epochs, 0.7 min on CPU.

| dev (153 alerts) | top-1 = counterfactual best | relative regret |
|---|---|---|
| model | 39.9% | 0.68% |
| rolling-horizon planner | 64.7% | 0.65% |
| no action | — | 0.65% |
| express rule | — | 1.76% |
| random valid slot | — | 2.41% |

**Offline, the tiny model only matches the planner and "no action"** on 419 training states. ECE 0.18.

## Closed-loop dev comparison: 40 dev instances, inversion regime
Sources: `experiments/results/dev-seed-evac-scratch/{summary.json, table.md, dev_eval.json}`; evaluator v2.0, SHA-256 `97e924f8…` (in `summary.json`).

| controller | P95 wait (s) | CVaR95 (s) | peak density (p/m²) | platform s ≥ 4 p/m² | censored / instance |
|---|---|---|---|---|---|
| timetable | 3385 | 3580 | 6.02 | 2599 | 176 |
| next train express | 3688 | 3876 | 6.08 | 3091 | 1443 |
| express rule (current practice, reactive) | 2623 | 2759 | 6.00 | 1668 | 21 |
| rolling horizon | 3146 | 3306 | 6.05 | 2276 | 144 |
| rolling horizon, omniscient (reference) | 3084 | 3245 | 6.04 | 2228 | 110 |
| **staging** (yard trains and buses on the declaration) + rolling horizon | **2221** | **2409** | 5.86 | 1075 | 4 |
| staging + express rule | 2292 | 2497 | 5.85 | 1167 | 5 |
| mixture (model decides, threshold 0) | **2178** | **2344** | 5.85 | 1034 | 0 |
| mixture (threshold 0.35; 93% fallback) | 2221 | 2408 | 5.86 | 1075 | 0 |

Paired comparisons (Wilcoxon over instances, bootstrap 95% CI of mean relative change):

| comparison | P95 | CVaR95 | peak density |
|---|---|---|---|
| staging vs express rule | −18.1% [−21.7, −14.5], p = 2.5e-11 | −14.2% | −3.0% [−6.3, −0.5] |
| timetable vs express rule | +35.1% | +36.3% | +0.5% |
| rolling horizon vs express rule | +19.4% [13.5, 25.8] | +20.3% | +0.8% |
| rolling horizon omniscient vs express rule | +17.4% | +18.0% | +0.6% |
| mixture (t=0) vs express rule | −19.2% [−22.9, −15.4] | −16.2% | −3.3% |
| **mixture (t=0) vs staging** | **−1.4% [−2.3, −0.5], p = 5.5e-4** | −2.3% [−3.3, −1.4] | −0.2% (n.s.) |

**E1 (dev estimate):** the operator's logs (half the observed headway per boarding, no left-behinds) understate true mean waits by **72.5%** (95% CI 69.2–75.7%), pooled over the `timetable` and `express_rule` runs. Left-behinds: 42–44% of passengers in truth, against 0 in the logs.

### What this does and doesn't show
- **Biggest effect: putting capacity in place on the declaration.** Staging yard trains and shuttle buses is worth about 18% on P95 over current practice, which reacts only once alerts arrive. This mirrors the elevator phase, where pre-positioning dominated.
- **Reacting without adding capacity hurts.**
  - Sending existing trains express (`next_train`, `rolling_horizon`) is worse than the express rule, which reaches for a yard train first.
  - Knowing the true crowd barely helps the planner (omniscient +17% vs +19%). Its weakness is its short-horizon fluid model, not missing information.
- **The decision model adds only about 1.4% on P95 beyond staging so far.** It is consistent across instances, but small, and comes from a 0.86M model trained on 419 states. Scaling CAGES and the backbones (E3) is the next test.
- **Caveats:**
  - n = 40 dev instances, and 15 of them overlap the labelled dev split (used only for temperature fitting and progress tracking).
  - The label horizon (900 s) is shorter than an evacuation. It probably undervalues yard trains, whose benefit lasts the whole evacuation; this could explain why offline labels favour "no action" while closed-loop results favour adding capacity. This needs testing, not assuming.
  - Peak density barely moves, because the platform caps at 6 p/m² by construction and the plaza is the overflow.
  - Night instances with thin service can't clear the crowd within the 2-hour horizon, so their waits are censored and their tails understated.
- **Status:** exploratory only. E2 (mixture vs the best classical dispatcher on the holdout) is the confirmatory test, once pre-registered.

*Safety scope: simulation research only. Nothing here certifies a station, a train service or an evacuation plan.*
