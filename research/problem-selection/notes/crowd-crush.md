# Crowd-crush prevention at mass gatherings

## Decision problem
**Who decides:** event organizers, police and transit operators, during a dense gathering. In real time they decide:
- when and where to meter or close access;
- whether to impose one-way flows;
- whether to reroute people or change transit (for example, closing a station or skipping a stop);
- where to send stewards and police.

**Under what uncertainty:**
- crowd inflow;
- local density, which is often not measured;
- the crowd's response to instructions [S1][S3].

## 1 Stakes
- **Itaewon (Seoul, 2022): 159 deaths** [S1].
  - Police had received 11 reports of dangerous crowding up to four hours before the crush.
  - The 137 officers dispatched were assigned mainly to crime and narcotics, not crowd control.
  - Yongsan Police Station had no crowd-control plan that year, despite plans in 2020 and 2021 [S1].
  - Manslaughter and negligence charges were sought against 23 officials [S2].
- **Love Parade (Duisburg, 2010):** 21 dead and over 500 injured [S3].
- **Attribution:** the deaths came from crowd density and flow management failures, which are logistics failures, not an external hazard [S1][S3].

## 2 Recalcitrance
- **The mechanism has been understood since at least 2012.** Helbing and Mukerji describe crowd disasters as systemic failures: "crowd turbulence" and cascading feedback rather than panic, with forces adding up as in granular matter [S3].
- **Disasters keep happening anyway,** often for organizational reasons such as missing plans and misallocated police [S1]. The gap is between known physics and operational control (inferred).

## 3 Simulability
- **Open simulators:**
  - JuPedSim: collision-free speed and generalized centrifugal force models, with crowd-management modules [S4];
  - Vadere: optimal steps, gradient navigation and social force [S5].
- **Open data:** the Jülich Pedestrian Dynamics Data Archive holds trajectory data, including high-density experiments (HERMES, BaSiGo, CroMa, CrowdDNA) and fundamental-diagram and bottleneck experiments with up to 250 people [S6][S7]. Field data at high density exist, for example the Fête des Lumières in Lyon [S8].
- **Weak spot:** the crush regime itself (force transmission, falls) is far less validated than free-flow and bottleneck flow (inferred from [S3][S8]).

## 4 Counterfactual leverage
- **High.** What would have happened with metering, a closed street or a closed station exit is never observed. A simulation can replay each one under the same inflow (inferred).

## 5 Honest loop metric
- **Candidate:** person-seconds above a critical density (for example, ≥ 5 people/m²), measured over the *whole* domain.
- **Gaming risk:** a loop could move people into unmeasured areas (inferred). The domain boundary therefore belongs in the frozen judge.

## 6 Baseline strength
- **Moderate:** density thresholds and the criticality scale [S3], built-in crowd-management measures in simulators [S4], and standard flow-capacity rules (inferred standard practice; not verified in these searches).
- **No strong optimization baseline** was found in these queries (inferred).

## 7 Sequential decisions
- **Yes.** Gating and rerouting decisions over minutes to hours as density builds [S1][S3].

## 8 Compute fit
- **The heaviest of the candidates.** Microscopic simulation of tens of thousands of agents costs minutes per scenario. Continuum or mesoscopic models are fast but less faithful in the crush regime (inferred).
- **Fit:** only hundreds of scenarios per 30-minute iteration at realistic scale (inferred; to be checked in T6).

## Prior program search / adversarial environment work
- **None found** in these queries. The full check is in T3.
- **Shared code:** CAGES already contains a social-force crowd model with an optional JuPedSim backend (`docs/cages.md`).

## Provisional scores (1–5)
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| 5 | 4 | 3 | 4 | 4 | 3 | 5 | 3 |

## Sources
- [S1] Semafor, "South Korea police admit to failures over Halloween crush", 2022-11-01; Al Jazeera, Korea Times coverage. https://www.semafor.com/article/11/01/2022/south-korea-police-admit-to-failures-over-halloween-crush (metadata only)
- [S2] CBS News, "Halloween crowd surge in Seoul: manslaughter charges sought" (23 officials), 2023-01. https://www.cbsnews.com/news/halloween-crowd-surge-seoul-manslaughter-charges-sought-almost-160-dead (metadata only)
- [S3] Helbing D., Mukerji P., Crowd disasters as systemic failures: analysis of the Love Parade disaster, EPJ Data Science, 2012 (ScienceDaily summary). https://www.sciencedaily.com/releases/2012/06/120626092625.htm (read); preprint https://arxiv.org/abs/1206.5856 (metadata only)
- [S4] JuPedSim, open-source pedestrian dynamics simulator (Forschungszentrum Jülich). https://pypi.org/project/jupedsim/1.0.0/ (metadata only)
- [S5] Kleinmeier B. et al., Vadere: An open-source simulation framework to promote interdisciplinary understanding, 2019. https://arxiv.org/abs/1907.09520 (metadata only)
- [S6] Pedestrian Crowd Management Experiments: A Data Guidance Paper, Collective Dynamics. https://www.collective-dynamics.eu/index.php/cod/article/view/A141 (metadata only)
- [S7] Seyfried A. et al., Enhanced empirical data for the fundamental diagram and the flow through bottlenecks. https://arxiv.org/abs/0810.1945 (metadata only)
- [S8] Dense Crowd Dynamics and Pedestrian Trajectories: A Multiscale Field Study at the Fête des Lumières in Lyon. https://arxiv.org/abs/2410.05288 (metadata only)
