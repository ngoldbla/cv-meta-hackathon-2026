# Venue and transit evacuation (CAGES)

## Decision problem
**Who decides:** the rail and bus dispatcher, when an emergency empties a crowded venue (Citi Field) into its subway station on the NYC 7 line. They decide:
- whether to stage yard trains and buses when the emergency is declared;
- which train or bus answers each platform-crowding alert.

**Under what uncertainty:** a hidden crowd, people left behind on full trains, door holding, a cold-start fleet and saturated egress (`docs/failure-modes.md`; [S1]).

## 1 Stakes
- **Transit-linked crowd incidents recur:**
  - 22 dead and 35 injured on a crowded footbridge between two Mumbai stations [S4];
  - in 2025 at least 10 dead in a crush outside a Bengaluru cricket stadium, where the stations around the stadium were shut as crowds filled the platforms [S5];
  - fans collapsing in an overcrowded NJ station before the Super Bowl [S6].
- **But it isn't the deadliest candidate.** No source found attributes venue-to-transit *evacuation* deaths on the scale of the wildfire or hurricane candidates (inferred).

## 2 Recalcitrance
- **Existing operations research** covers metro rescheduling under over-crowded, time-dependent passenger flow, including station skipping during recovery [S2], and bus-based evacuation planned for fixed evacuee counts (Bish 2011, cited in [S1]).
- **Measurement is a gap.** Left-behind passengers are a recognized measurement problem (MassDOT 2018, cited in [S1]).
- **CAGES dev estimate (E1, exploratory):** operator logs understate the true mean wait by 72.5% [69.2, 75.7]. In truth 42–44% of passengers are left behind at least once, against zero in the logs [S1].

## 3 Simulability
- **Already built and calibrated:**
  - an event-driven 7-line simulator calibrated to MTA GTFS run times (each stop-to-stop time within 1 s, total within 3%) [S1];
  - R188 train capacity, the Citi Field capacity and Green Guide egress anchors [S1];
  - a Weidmann-calibrated crowd model (speed RMSE < 0.12 m/s) [S1];
  - counterfactual labels that match brute-force replay exactly [S1].

## 4 Counterfactual leverage
- **The CRN replay labels already exist** [S1]. What they showed:
  - the per-alert decisions have modest leverage, with best-vs-worst slot gaps of 5% (900 s horizon) to 11% (2,700 s) of local cost [S1];
  - the best decision model adds −3.45% P95 beyond staging (Laya @0.0, CI [−4.85, −2.01]) [S3];
  - the big lever, staging at the declaration, is worth −18.1% against the express rule [S1].

## 5 Honest loop metric
- **The current metric is the wrong one.** P95 wait from plaza arrival to boarding is a transit-service metric (spec §3).
- **Density barely moves.** Peak density stays at 5.80–5.86 people/m² for every controller, because the platform caps at 6 by construction [S3].
- **What an honest metric needs:**
  - timing from the seat to boarding, so holding people in the stadium can't be gamed;
  - an exposure term (person-seconds above 4 people/m²) (spec; inferred).

## 6 Baseline strength
- **Strong in the simulator:** staging plus the rolling-horizon dispatcher, at P95 2220.78 [S3].
- **Externally:** MIP rescheduling exists [S2].

## 7 Sequential decisions
- **Moderate.** About 8 alerts per evacuation (23,554 labelled states over 3,000 train instances), plus one staging decision [S3].

## 8 Compute fit
- **Measured, and comfortable:**
  - one blue benchmark iteration (scratch-20M training plus closed-loop evaluation on 2 dev instances) took 177 s on the RTX 5060 Ti on 2026-10-29 (M2 smoke test);
  - generating the 3,300-instance v0 dataset took about 1 h 50 on 24 workers [S3].

## Prior program search / adversarial environment work
- **The adversarial part exists, the program search doesn't.** CAGES already samples adversarial failure modes, with severities skewed toward the worst (`docs/failure-modes.md`). No LLM program search was found. The full check is in T3.

## Provisional scores (1–5)
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| 3 | 3 | 5 | 3 | 3 | 4 | 3 | 5 |

## Sources
- [S1] This repository: `research/results.md` (v0-mini results, E1 dev estimate, validation table) and `docs/failure-modes.md`; README references Gao et al. 2016, MassDOT 2018, Bish 2011. (read)
- [S2] Gao Y., Kroon L., Schmidt M., Yang L., Rescheduling a metro line in an over-crowded situation after disruptions, Transportation Research Part B 93:425–449, 2016. https://ideas.repec.org/a/eee/transb/v93y2016ipap425-449.html (metadata only)
- [S3] This repository: `experiments/results/dev-selection.md`, `ops/reports/002-transit-v0-and-backbones.md`, and `experiments/results/dev-evac-*/summary.json`. (read)
- [S4] Working with Crowds, "22 dead, 35 injured in crowd incident at Mumbai's Elphinstone Road station". https://www.workingwithcrowds.com/mumbai-railway-station/ (metadata only)
- [S5] "At least 10 die in crush at India cricket stadium" (Bengaluru, June 2025). https://peopledaily.digital/sports/at-least-10-die-in-crush-at-india-cricket-stadium/amp (metadata only)
- [S6] Fox News, "Super Bowl fans collapse at crowded NJ train station". https://www.foxnews.com/sports/super-bowl-fans-collapse-at-crowded-nj-train-station (metadata only)
