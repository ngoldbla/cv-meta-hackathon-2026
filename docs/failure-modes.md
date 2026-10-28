# Failure modes (inversion: "how would we guarantee the worst evacuation?")

Each mode is a parametric mechanism with severity s ∈ [0, 1] (`cages/sim/line.py: FailureModes`). Each has a unit test showing its effect (`tests/test_sim.py::test_each_failure_mode_has_its_effect`).

| Mode | Mechanism in the simulator | Assumption it breaks |
|---|---|---|
| **W1 hidden crowd** | Platform-crowding alerts arrive later (60 s → 300 s) and their level thresholds double, so a "level 3" alert can stand for ten thousand people. With fare gates opened for the evacuation, there is no tap data to fall back on | passenger flows known to the dispatcher [Gao et al. 2016] |
| **W2 left behind** | Uneven car loading wastes up to 25% of each train's capacity. Once an alert is served, a still-stranded crowd is re-reported only after up to 300 s. Passenger counters never see left-behinds | everyone boards the first train [MassDOT 2018] |
| **W4 door holding** | At crowded platforms, doors are re-opened about Poisson(3·s) times per stop, each adding 5–20 s, and the delay propagates to every train behind (one train per block) | scheduled dwell times |
| **W6 cold start** | Service thins (up to half the trains), the yard has fewer spare trains (6 → 2) that need up to 25 min to crew, and buses start at a far depot (0.6 → 8 km) with drivers up to 30 min away | a warm, well-staged fleet at emergency onset [Bish 2011 assumes buses ready at depots] |
| **W9 saturated egress** | Stairs and fare arrays at the event station pass only 35% of their nominal flow, and the plaza outside is halved, so the crowd waits outside in the open | an unconstrained path onto the platform |

The inversion sampler (`cages/data/instances.py: sample_failures`) draws severities from Beta(2, 1.2), skewed toward severe, and switches modes off at random so their effects can be separated. The other instance parameters are drawn too:
- occupancy (15,000–41,922);
- subway share (30–60%);
- release window (8–25 min);
- hour and day type, which set the GTFS headway;
- the station's entry capacity and platform area.

Metrics are about tails, not means:
- P95 wait and CVaR₉₅ wait, measured from reaching the station to boarding;
- P95 wait for evacuees and for wheelchair users;
- peak density at the event station: the platform, capped at 6 p/m², or the plaza outside, which is not capped;
- seconds above 4 p/m² on the platform and in the plaza;
- the share of evacuees left behind at least once (true), against zero in the operator's view;
- operator-log understatement (E1): one minus logged over true mean wait. The logged wait is half the observed headway per boarding, which is all that train logs and passenger counters can support;
- the share of evacuees who stood on the platform for more than 4 minutes. This is an NFPA 130 reference only, not a certification.

*Safety scope: simulation research only. Nothing here certifies a station, a train service or an evacuation plan.*
