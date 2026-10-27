# Results

All results here are **exploratory (dev split)** unless marked *confirmatory*. Confirmatory results come only from `eval_holdout` runs recorded in `research/ledger.jsonl`. None have been run yet: H1–H3 are pre-registered (ledger entries 0–2), and the holdout salt is held by the repository author.

## Validation of the instrument
Source: `tests/`. All pass.

| Check | Result |
|---|---|
| Up-peak round-trip time vs Barney's formula | within 2% (`test_round_trip_time_matches_barney`) |
| Crowd speed vs Weidmann (0.5–3 p/m²) | RMSE < 0.12 m/s; 0.09 m/s over 0.5–4 p/m² (`test_social_force_matches_weidmann`). Jams to 0 at 4 p/m², where Weidmann gives 0.16 |
| Counterfactual labels vs independent brute-force replay | exact match (`test_counterfactual_labels_match_brute_force_replay`) |
| Each failure mode W1, W2, W4, W6, W9 produces its effect | yes (`tests/test_sim.py`) |
| Anchors (bottleneck flow, stadium egress, EN 81-20 area, registry, door/transfer times) | enforced (`tests/test_anchors.py`) |

## CAGES v0-mini
Source: `datasets/cages-v0-mini/` (ledger entry 3).
- **Size:** 60 train and 15 dev instances, giving **1,532 / 382** labelled decisions. Labels use K=4 CRN rollouts and a 240 s horizon.
- **How often baselines pick the counterfactual-best car:** ESA 25.4% and ETA 28.0% on dev, against 16.7% for a random choice.
- **Label noise:** the median gap between best and worst car is about 1% of cost, so labels are noisy (`stats.json`).

## Decision model: tiny CPU run
Source: `experiments/results/seed-scratch-metrics.json`. Scratch transformer, 0.87M parameters, 40 epochs, 3.4 min on CPU.

| dev (382 states) | top-1 = counterfactual best | relative regret |
|---|---|---|
| model | 28.5% | 1.17% |
| ESA | 25.4% | 1.07% |
| ETA | 28.0% | 1.02% |
| random | 16.7% | 2.03% |

**Offline, the tiny model does not beat ESA on regret.** It is better than random and comparable to the classical planners. Calibration: ECE 0.07, temperature 1.30.

## Closed-loop dev comparison: 20 dev instances, inversion regime
Sources: `experiments/results/{summary.json, table.md, dev_eval.json}`. Evaluator SHA-256 is recorded in `summary.json`.

| controller | P95 wait (s) | CVaR95 (s) | peak landing density (p/m²) | lobby s ≥ 4 p/m² | censored / instance |
|---|---|---|---|---|---|
| closest_car | 3281 | 3312 | 4.55 | 1082 | 275 |
| eta | 3378 | 3409 | 4.62 | 1121 | 334 |
| esa | 3389 | 3420 | 4.62 | 1162 | 329 |
| esa_omniscient (reference) | 3339 | 3374 | 4.59 | 1124 | 305 |
| tsai_standby | 3018 | 3056 | 4.49 | 980 | 125 |
| esa + schedule pre-positioning | 2518 | 2565 | 4.42 | 740 | 23 |
| **mixture (model decides, threshold 0)** | **2233** | **2279** | **4.35** | **628** | **9** |
| mixture (threshold 0.35; 88% fallback to ESA) | 2489 | 2544 | 4.41 | 741 | 25 |

Paired comparisons (Wilcoxon over instances, bootstrap 95% CI of mean relative change):

| comparison | P95 | CVaR95 | peak landing density |
|---|---|---|---|
| esa + schedule vs esa | −28.7% [−36.4, −20.7] | −28.0% | −6.2% |
| mixture (t=0) vs esa | −37.6% [−45.6, −29.2] | −36.8% | −9.4% |
| **mixture (t=0) vs esa + schedule** | **−13.5% [−17.1, −10.5], p = 1.9e-6, 20/20 instances improved** | −13.3% | −3.7% [−8.3, −0.7] |
| tsai_standby vs esa | −13.7% | −13.3% | −4.3% |
| esa_omniscient vs esa | −1.8% | −1.6% | −0.8% |

**H1 (dev estimate):** call-based waits, the standard log, understate true mean passenger waits by **98.4%** (95% CI 97.9–98.7%), pooled over the `esa` and `closest_car` runs.

### What this does and doesn't show
- **Biggest effect: pre-positioning before the surge.** It is worth about 29% on P95 by itself. History-based standby (Tsai) recovers about half of that. Knowing true queue lengths (omniscient ESA) is worth only about 2%: in a crush, the bottleneck is where the cars are, not what the dispatcher knows.
- **The decision model adds about 13% on P95 beyond pre-positioning, in closed loop,** even though offline it only matched ESA's per-decision regret. One plausible explanation is that long-run effects compound beyond the 240 s label horizon. This needs testing, not assuming.
- **Caveats:**
  - **Small sample:** n = 20 dev instances.
  - **Overlap:** 15 of the 20 are the labelled dev instances. They were used only for progress tracking and temperature fitting, which does not affect decisions at threshold 0. Training used disjoint instances.
  - **Optimistic forecaster:** the schedule forecaster knows the generator's exact release-profile shape and attendee count. A real operator knows the event time and capacity, but not the profile. A learned forecaster such as Timestral must replace it before any claim.
  - **Censoring:** baselines leave many passengers unserved at the horizon. Their tails are therefore truncated, so the improvements are, if anything, understated.
  - **Calibration threshold:** at threshold 0.35, 88% of decisions fall back to ESA, so confidence calibration and the threshold need tuning on dev.
- **Status:** exploratory only. H2 (mixture vs ESA + forecaster on the holdout) is the confirmatory test.

## Forecasting: what pre-positioning actually needs (GPU machine plus this container, dev, exploratory)
Sources:
- `experiments/results/forecast_eval.json` (n=15, RTX 5060 Ti, Timestral-28M zero-shot);
- `experiments/results/prior_robustness.json` (n=20, closed loop).

| forecaster (per-floor passenger demand) | WAPE @120 s | WAPE @600 s |
|---|---|---|
| schedule prior (knows the true release shape) | 0.114 | 0.114 |
| Timestral, blended 50/50 with the prior | 0.523 | 0.541 |
| Timestral only (schedule as a known-future covariate) | 1.026 | 1.064 |
| hall-call history only (persistence) | 1.002 | 1.000 |

**Zero-shot Timestral can't recover crowd demand from hall-call counts.** It does no better than persistence, and blending it in makes the prior worse. This follows from H1: in a crush, calls are decoupled from the number of people waiting, so any forecaster limited to call logs is blind to the crowd. Learned forecasting needs a people-level signal, such as door or turnstile counts or ticketing scans. Calls alone won't do.

| closed loop, P95 wait vs ESA (n=20) | Δ P95 [95% CI] | Δ CVaR95 | Δ peak density | Δ lobby s ≥ 4 p/m² |
|---|---|---|---|---|
| ESA + exact schedule prior | −28.7% [−36.5, −21.0] | −28.0% | −6.2% | −14.9% |
| ESA + flat-profile prior (knows only event time, floor and announced attendance) | −28.4% [−35.9, −20.8] | −27.8% | −6.1% | −14.9% |
| same, attendance overstated by 43% | −28.5% | −27.9% | −6.3% | −14.7% |
| same, attendance understated by 30% | −28.4% | −27.7% | −6.2% | −14.8% |

**Pre-positioning is robust to a misspecified prior.** Its benefit depends on knowing *when and where* the surge starts, which any published event schedule provides, not on its exact shape or size. This largely removes the earlier "optimistic forecaster" caveat for the pre-positioning result.

Still open: the decision model was trained with the exact prior's demand features, and has not yet been tested under the misspecified prior.

*Safety scope: simulation research only. Nothing here certifies any building or evacuation strategy.*
