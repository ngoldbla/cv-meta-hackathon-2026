# Wildfire evacuation timing and zone sequencing

## Decision problem
**Who decides:** county emergency managers, sheriffs and fire command, as a wildfire approaches a wildland-urban interface (WUI) community. They decide:
- when to issue evacuation orders, zone by zone;
- which routes to open, close or contraflow;
- where to send people who cannot get out (temporary refuge areas).

**Under what uncertainty:**
- fire spread and spotting;
- residents' departure times and compliance;
- road capacity lost to fire, debris and crashes [S2][S5][S12].

## 1 Stakes
- **2018 Camp Fire (Paradise, CA):** 85 deaths, about 40,000 evacuees and more than 18,000 structures destroyed. NIST documents 31 temporary refuge areas sheltering more than 1,200 civilians, 198 assistance or rescue events, and at least 1,000 civilians rescued [S2].
- **Burnovers.** Vehicles were overrun by fire while people were fleeing in them, during the Camp Fire evacuation [S4].
- **Gridlock.** Narrow exit routes gridlocked, and trips that normally take 25 minutes took hours. Some people died stuck in traffic. (Search metadata of news coverage; to be verified against [S1] in T5.)
- **2023 Lahaina (Maui):** at least 102 deaths [S5].
  - More than 60% of the victims tried to flee. Many were found in or beside cars, on streets or against the seawall.
  - Traffic jams formed from downed poles, crashes, dead signals and poor visibility, and locked gates closed back roads.
  - Kuhua Street, the only escape route for many residents, had over two dozen victims [S5].
  - The Fire Safety Research Institute, investigating for the Hawaii attorney general, found "no evidence" officials prepared despite advance warnings [S5][S6].
- **Attribution to logistics:** in both fires a large share of deaths occurred during flight, which points at routes, timing and notification and not only at fire intensity (inferred from [S2][S5]).

## 2 Recalcitrance
- **Research history.** Evacuation planning and traffic modelling go back decades. Current methods include:
  - simulation-optimization of each evacuee's departure time and exit (Victoria, Australia, 2016) [S10];
  - phased zone evacuation methods (WUI-PEM, 2024) [S7];
  - staged evacuation studies showing fewer vehicles near the fire front than with simultaneous evacuation [S9].
- **Practice keeps failing.** Paradise and Lahaina both show route loss and late or absent notification despite this literature [S2][S5][S6].
- **No adopted decision tool.** No source found shows a deployed tool that sets zone order timing under fire-spread uncertainty (inferred: absence in the searches logged).

## 3 Simulability
- **Open simulator.** WUI-NITY couples three layers [S11]:
  - FARSITE-based fire spread;
  - a pedestrian response and movement model;
  - LWR (Lighthill-Whitham-Richards) macroscopic traffic, with OpenStreetMap road networks.
- **RL environments:** PyroRL (JOSS 2024) for wildfire evacuation [S13], and JaxWildfire, a GPU-accelerated wildfire simulator for RL [S14].
- **Behavior calibration data:** survey data for the 2017 Southern California fires (n = 226) and the 2018 Carr Fire (n = 284), with departure-time, mode, route, destination and shelter choices, and latent "keen" and "reluctant" classes that react differently to mandatory orders [S12].
- **Validation data:** NIST integrated more than 2,600 observations into a timeline of the Camp Fire evacuation, a rare ground truth for checking a simulator [S2].

## 4 Counterfactual leverage
- **One run, no alternatives.** Logs and reconstructions such as NIST NETTRA show one realized timeline. They cannot show what would have happened under a different order time, zone sequence or contraflow plan [S2].
- **High value of replay.** Replaying every option under the same fire and behavior draws (common random numbers) gives exactly what logs lack. Order timing interacts strongly with traffic (the staged vs simultaneous results [S9]), so the counterfactual value is high (inferred).

## 5 Honest loop metric
- **Candidate:** expected person-minutes of exposure, meaning evacuees on the road or in the zone within distance d of the fire front, or still in a zone when the fire arrives. A frozen evaluator can compute it from the simulated fire perimeters and the vehicle and pedestrian positions.
- **Alternatives:**
  - the number of evacuees not cleared before fire arrival;
  - the P95 time to safety.
- **Gaming risks:**
  - ordering everyone at once (the simulator must reproduce gridlock);
  - exploiting gaps in the fire model;
  - over-trusting compliance.

  The fire model, the behavior model and the compliance parameters must therefore sit in the frozen judge (inferred).

## 6 Baseline strength
- **Classical:** phased-zone plans from simulation-optimization [S7][S10], and staged evacuation [S9]. The Marin County study tested vehicle reduction, phased evacuation and parking restrictions in a wildfire-traffic simulation [S8].
- **Current practice:** zone orders issued by officials as the fire advances. In Lahaina, preparation was absent [S6].
- **Assessment:** credible baselines exist, but no single standard planner (inferred).

## 7 Sequential decisions
- **Yes.** Orders, route closures and refuge decisions unfold over hours as the fire spreads.
- **Scale:** tens of zone-level decisions per incident (inferred from the zone-based methods [S7]).

## 8 Compute fit
- **Traffic:** macroscopic LWR on a town-scale network runs fast (seconds to minutes per scenario, inferred from model class [S11]).
- **Fire spread:** FARSITE-class runs can be precomputed and cached per scenario.
- **GPU:** JaxWildfire indicates GPU-speed fire simulation is feasible [S14].
- **Fit:** thousands of scenario-runs per 30-minute iteration look feasible on 24 cores (inferred; to be checked in T6).

## Prior program search / adversarial environment work
- **RL exists:** deep RL for evacuation routing (2025 Flin Flon case study) [S15], and RL environments for wildfire evacuation [S13][S14].
- **The method doesn't:** no LLM program search or regret-based adversarial scenario generation was found for wildfire evacuation in these queries. The full check is in T3.

## Provisional scores (1–5)
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| 5 | 4 | 4 | 5 | 4 | 3 | 5 | 4 |

## Sources
- [S1] California Governor's Office of Emergency Services, 2018 Camp Fire After Action Report (508 clean copy, 2025). https://www.caloes.ca.gov/wp-content/uploads/Preparedness/Documents/FINAL-AAR-2018-Camp-Fire-508-Clean-Copy-11.17.25.pdf (PDF; metadata only)
- [S2] Maranghides A., Link E., Brown C.U., Walton W.D., Mell W., Hawks S., A Case Study of the Camp Fire: Notification, Evacuation, Traffic, and Temporary Refuge Areas (NETTRA), NIST Technical Note 2252, July 2023. https://www.nist.gov/publications/case-study-camp-fire-notification-evacuation-traffic-and-temporary-refuge-areas-nettra (read: publication page)
- [S3] (unused)
- [S4] Burnover events identified during the 2018 Camp Fire, International Journal of Wildland Fire 32(6) 989. https://connectsci.au/wf/article/32/6/989/86710/Burnover-events-identified-during-the-2018-Camp (metadata only)
- [S5] AP via PBS NewsHour, "Lahaina wildfire victims made it just blocks before becoming trapped by flames, report says", 2024-09-14 (on the Fire Safety Research Institute report for the Hawaii AG). https://www.pbs.org/newshour/nation/lahaina-wildfire-victims-made-it-just-blocks-before-becoming-trapped-by-flames-report-says (read)
- [S6] NPR, "Report: 'No evidence' Hawaii officials prepared for deadly wildfire, despite warnings", 2024-09-14. https://www.npr.org/2024/09/14/g-s1-23028/report-hawaii-officials-wildfire-warnings (metadata only)
- [S7] WUI-PEM: Wildfire Phased Zone Evacuation Methodology, ISCRAM Proceedings 2024. https://ojs.iscram.org/index.php/Proceedings/article/view/78 (metadata only)
- [S8] Soga K., Comfort L., Zhao B., Li P., Lorusso P., Policy brief: A case study testing wildfire evacuation strategies for communities in Marin County, California, UC ITS, 2024. https://ucits.org/research_products/policy-brief-a-case-study-testing-wildfire-evacuation-strategies-for-communities-in-marin-county-california/ (read: brief page; numeric results not on that page)
- [S9] University of Alabama staged wildfire evacuation model (UA news). https://news.ua.edu/?p=166266 (metadata only; the PreventionWeb copy returns 403 to scripts)
- [S10] Integration of simulation and optimization for evacuation planning (University of Melbourne, 2016). https://findanexpert.unimelb.edu.au/scholarlywork/1085313-integration-of-simulation-and-optimization-for-evacuation-planning (metadata only)
- [S11] Evacuation modelling for bushfire: the WUI-NITY simulation platform, Australian Journal of Emergency Management, October 2022. https://knowledge.aidr.org.au/resources/ajem-october-2022-evacuation-modelling-for-bushfire-the-wui-nity-simulation-platform/ (metadata only)
- [S12] Wong S.D., Broader J.C., Walker J.L., Shaheen S.A., Understanding California wildfire evacuee behavior and joint choice making, Transportation 50(4):1165–1211, 2023. https://ideas.repec.org/a/kap/transp/v50y2023i4d10.1007_s11116-022-10275-y.html (metadata only)
- [S13] PyroRL: a reinforcement learning environment for wildfire evacuation, Journal of Open Source Software, 2024. https://joss.theoj.org/papers/10.21105/joss.06739 (metadata only)
- [S14] JaxWildfire: A GPU-Accelerated Wildfire Simulator for Reinforcement Learning, arXiv 2512.06102. https://arxiv.org/abs/2512.06102 (metadata only)
- [S15] Mitacs project: Learning optimal wildfire evacuation routes for Flin Flon (2025 wildfire case study). https://www.mitacs.ca/our-projects/learning-optimal-wildfire-evacuation-routes-for-flin-flon-2025-wildfire-case-study/ (metadata only)
