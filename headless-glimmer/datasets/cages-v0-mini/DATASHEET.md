# Datasheet: cages-v0-mini

**Motivation.** Real rail logs can't show what would have happened under a different dispatch decision, and in an evacuation they hide most of the waiting: passenger counters and train logs cannot see the people left behind on a platform, and opened fare gates leave no tap data. CAGES supplies counterfactual labels for every candidate action, under deliberately worst-case conditions.

**Composition.** Each record is one platform-crowding alert on the NYC 7 line during an emergency evacuation of the venue next to Mets-Willets Point:
- observable features (what a real rail controller sees);
- for each candidate slot, the tail-aware ground-truth waiting cost over a horizon, estimated with common-random-number rollouts.

| split | instances | labelled states |
|---|---|---|
| train | 60 | 419 |
| dev | 15 | 153 |

**Collection process.** Fully synthetic, from the `cages` simulator at code SHA `ee0198bba088`. Label config: `{"K": 4, "horizon": 900.0, "p_label": 1.0, "max_states": 20, "epsilon": 0.25, "tau": 60.0}`.
Station order, positions, run times and headways come from the MTA subway GTFS feed; background riders from
MTA Subway Hourly Ridership (data.ny.gov `wujg-7c2s`, aggregates only). Train, station and crowd parameters are
anchored to published figures (see `anchors/`). Failure-mode severities are drawn from an inversion regime
skewed toward severe conditions.

**Uses.**
- Training and evaluating dispatch policies (imitation and offline RL);
- calibration studies;
- estimating how badly operator logs understate evacuation waits.

Not suitable for certifying a station, a train service or an evacuation plan.

**Fields.**

- `veh`: per-slot observable features (8 slots x 14): no action, four nearest trains express, a yard train, two buses
- `stn`: per-station observable features (22 stations x 12)
- `glob`: global observable features (13)
- `mask`: valid candidate slots
- `q_k`: counterfactual tail-aware waiting cost per CRN rollout and slot (K x 8; NaN = invalid slot)
- `q_mean`: mean counterfactual cost per slot
- `q_std`: std of counterfactual cost across CRN rollouts
- `best`: index of the counterfactual-best slot
- `planner_choice`: slot chosen by the rolling-horizon dispatcher
- `rule_choice`: slot chosen by the express rule (current practice)
- `t`: decision time (s)
- `call`: alert (station, direction, level)
- `instance`: instance id (see specs.jsonl)

**Holdout.** The holdout split is generated on demand from a secret salt and is never distributed.

**License.** CC BY 4.0 (data); MIT (code). Author: Dylan Goldblatt.
