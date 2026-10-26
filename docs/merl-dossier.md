# MERL dossier: the strongest academic group-control line, and its by-design limits

| Work | Method | Stated assumptions relevant to crowds |
|---|---|---|
| Nikovski & Brand, ICAPS 2003 (TR2003-61), best applied paper | ESA-DP: exact expected residual waiting time via DP over a Markov chain embedded in each car's phase space; −70% waiting in heavy traffic, −20% on average over 20,000 building/traffic cases | **Future arrivals ignored**; scheduler **omniscient about the number waiting** at each floor; **infinite car capacity**; collective service; immediate assignment |
| Nikovski & Brand, UAI 2003 | Marginalising out future passengers (semi-Markov lobby model) | Stationary arrival model |
| Brand & Nikovski, ICRA 2004 (TR2004-044; US 6,808,049, expired) | Optimal parking of idle cars; down-peak up to 80% gains; up-peak via MDP and DP | Steady traffic patterns |
| Brand & Nikovski, ELEVCON 2004 | Risk-averse scheduling | — |
| Ramalingam, Raghunathan & Nikovski, ICAPS 2017 (US 10,118,796, active) | Submodular maximisation under a partition matroid; quadratic Boolean waiting-time model (exact for at most 2 calls per car) | **Number of passengers behind a hall call unknown**; waiting measured **from button press**; no prediction; evaluated in a commercial simulator |
| Zhang et al., ECC 2022 (arXiv 2208.08948; US 12,210,987, active) | Transformer predicts who heads to the elevator from lobby trajectories; predictive scheduler | Only 55 training trajectories per floor; closed simulators (SimTread, Elevate). **A prescient scheduler's AWT advantage falls from ~75% at light load to under 10% near 1,000 people/hour** |

## How CAGES uses this
- `ESAPlanner` rebuilds the ESA principle from the papers; the covering patents have expired.
  - The default observes one passenger per call, which is all a conventional controller can see.
  - `omniscient=True` reproduces the "known waiting count" assumption, as a reference.
- The submodular method and the uncertain-future-arrivals method (US 9,834,405) are covered by active patents. They are not implemented here, pending legal review.
- The failure modes target the assumptions above:
  - hidden queues (W1);
  - full cars clearing calls (W2);
  - held doors (W4);
  - cold starts (W6);
  - saturated discharge lobbies (W9).
- The logger view reproduces "waiting measured from button press", so its bias can be quantified (H1).
