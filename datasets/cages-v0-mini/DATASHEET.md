# Datasheet: cages-v0-mini

**Motivation.** Real elevator logs can't show what would have happened under a different dispatch decision, and in crowd surges they hide most of the waiting (one hall call can stand for hundreds of people). CAGES supplies counterfactual labels for every candidate action, under deliberately worst-case conditions.

**Composition.** Each record is one hall-call decision in a 30-floor, 6-car venue tower during an event surge:
- observable features (what a real controller sees);
- for each candidate car, the tail-aware ground-truth waiting cost over a horizon, estimated with common-random-number rollouts.

| split | instances | labelled states |
|---|---|---|
| train | 60 | 1532 |
| dev | 15 | 382 |

**Collection process.** Fully synthetic, from the `cages` simulator at code SHA `e18db0b`. Label config: `{"K": 4, "horizon": 240.0, "p_label": 0.12, "max_states": 30, "epsilon": 0.25, "tau": 60.0}`.
Car speed and rated load come from real NYC tall elevator banks (NYC Open Data `juyv-2jek`, aggregates only).
Crowd and door parameters are anchored to published statistics (see `anchors/`). Failure-mode severities are drawn
from an inversion regime skewed toward severe conditions.

**Uses.**
- Training and evaluating dispatch policies (imitation and offline RL);
- calibration studies;
- estimating how badly logs understate crush waits.

Not suitable for certifying real buildings or evacuation procedures.

**Fields.**

- `car`: per-car observable features (n_cars x car_dim)
- `floor`: per-floor observable features (n_floors x 12)
- `glob`: global observable features (7)
- `mask`: valid candidate cars
- `q_k`: counterfactual tail-aware waiting cost per CRN rollout and candidate car (K x n_cars)
- `q_mean`: mean counterfactual cost per candidate car
- `q_std`: std of counterfactual cost across CRN rollouts
- `best`: index of the counterfactual-best car
- `esa_choice`: car chosen by the ESA planner baseline
- `eta_choice`: car chosen by the ETA baseline
- `t`: decision time (s)
- `call`: hall call (floor, direction)
- `instance`: instance id (see specs.jsonl)

**Holdout.** The holdout split is generated on demand from a secret salt and is never distributed.

**License.** CC BY 4.0 (data); MIT (code). Author: Dylan Goldblatt.
