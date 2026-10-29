# Which emergency-logistics problem should the loop attack? A scored survey

## Executive summary
- **Eight candidates** were scored on the spec's 8-criterion scorecard, each 1–5, with every score tagged to a source in `notes/`. All eight pass the hard filters (criteria 5 and 8 at 3 or above).
- **Top three:** wildfire evacuation timing and zone sequencing (34), EMS dispatch under surge (34; it loses the tie-break on counterfactual leverage), and hurricane phased evacuation (33).
- **Recommendation: wildfire evacuation**, with the loop metric *expected person-minutes of fire exposure* and the biggest risk being the validity of the fire-spread and departure-behavior models in the frozen judge.
- **Novelty is partial** [1]. LLM program search with an adversarial instance generator already exists (RAISE, 2026). Our claim must be narrowed to the regret adversary, a calibrated emergency judge, per-decision counterfactual feedback and a pre-registered holdout.
- **The scores are coarse.** A 1-point gap is within judgment noise, so the top four are close (inferred).

## Ranked table
| # | Candidate | 1 Stakes | 2 Recalc. | 3 Sim. | 4 CF lev. | 5 Metric | 6 Baseline | 7 Seq. | 8 Compute | Sum | Proposed loop metric | Biggest risk |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Wildfire evacuation | 5 | 4 | 4 | 5 | 4 | 3 | 5 | 4 | **34** | expected person-minutes of fire exposure | fire-spread and departure-behavior model validity |
| 2 | EMS surge dispatch | 3 | 3 | 5 | 4 | 4 | 5 | 5 | 5 | **34** | share of urgent calls reached within target | very strong existing baselines; deaths weakly tied to dispatch |
| 3 | Hurricane evacuation | 5 | 4 | 4 | 5 | 3 | 4 | 5 | 3 | **33** | expected cost (exposure + false-alarm evacuation) | metric needs a contested weight; regional networks are heavy |
| 4 | Relief last mile | 4 | 4 | 3 | 4 | 4 | 4 | 5 | 5 | **33** | total deprivation cost | contested deprivation valuations; thin operational data |
| 5 | MCI patient distribution | 3 | 4 | 3 | 4 | 4 | 4 | 5 | 5 | **32** | expected survivors | expert-elicited deterioration curves; self-transport |
| 6 | Crowd crush | 5 | 4 | 3 | 4 | 4 | 3 | 5 | 3 | **31** | person-seconds above critical density | crush-regime physics unvalidated; microsimulation cost |
| 7 | Healthcare-facility evacuation | 4 | 4 | 3 | 4 | 3 | 4 | 4 | 5 | **31** | expected excess deaths (transfer + exposure) | weak outcome models for transfer harm |
| 8 | Venue/transit evacuation (CAGES) | 3 | 3 | 5 | 3 | 3 | 4 | 3 | 5 | **29** | seat-to-board time + density exposure | low decision leverage; density capped by construction |

**Tie-breaks:** wildfire beats EMS on criterion 4 (5 vs 4); hurricane beats relief on criterion 4 (5 vs 4); crowd crush beats healthcare-facility evacuation on criterion 1 (5 vs 4).

## Per-candidate rationale
- **Wildfire evacuation.**
  - Most deaths happened during flight: 85 deaths in the Camp Fire, where NIST documents 31 temporary refuge areas and at least 1,000 rescued [2]; at least 102 in Lahaina, where more than 60% of victims tried to flee and road blockages and locked gates trapped them [3].
  - Open coupled fire/pedestrian/traffic simulation exists (WUI-NITY) [4], plus behavior survey data [5] and a 2,600-point validation timeline [2].
  - Order timing is the classic counterfactual that logs can't show, and staged evacuation is known to matter [6].
  - Baselines are credible but not standardized [7][8].
- **EMS surge dispatch.**
  - The best data and tools: public dispatch datasets and open simulators (OpenEMS, an RL benchmark) [9][10], and very strong ADP and MSOM baselines [11][12].
  - But in the heat dome most of the 619 deaths were older people at home alone, so dispatch is a minor lever on them [13]. Routine simulation also reduces the novelty of counterfactual data (inferred).
- **Hurricane evacuation.**
  - Rita's evacuation killed 107, more than the storm, including heat deaths in gridlock and a bus fire [14].
  - Strong operations-research baselines exist (CTM optimization, multistage stochastic programming, hazard trees) [15][16][17].
  - But the metric must trade exposure against false-alarm evacuation, and regional networks are heavy (inferred).
- **Relief last mile.**
  - Maria: shipments took more than two months on average, and visibility was lost on nearly 40% of them [18].
  - Deprivation cost gives a principled objective [19], but the valuations are contested and operational data is thin (inferred).
- **MCI patient distribution.**
  - The nearest hospitals were overwhelmed by about 800 self-transported casualties in Las Vegas [20].
  - Strong policies beat START [21][22], but the outcome model rests on expert-elicited deterioration curves [23].
- **Crowd crush.**
  - The highest stakes per incident: 159 dead at Itaewon, where police had 11 warning calls [24].
  - The physics is understood [25] and the data is open [26], but the crush regime is unvalidated and microsimulation at scale is expensive (inferred).
- **Healthcare-facility evacuation.**
  - Evacuation itself raises mortality: +3.9 points at 90 days for residents with severe dementia [27].
  - But outcome models are observational and weak (inferred).
- **Venue/transit evacuation (CAGES).**
  - The best-calibrated simulator and the cheapest compute [28].
  - Its own results show low decision leverage (the model adds −3.45% beyond staging) and a density metric capped by construction [29].

## Dropped by hard filter
None. The lowest criterion-5 and criterion-8 scores are 3 (hurricane, healthcare, CAGES; crowd crush, hurricane).

## Recommendation
- **Problem:** wildfire evacuation timing and zone sequencing for a WUI community.
- **Single loop metric:** *expected person-minutes of fire exposure.* Summed over evacuees, it counts the minutes each person spends on a road segment or in a zone within distance *d* of the simulated fire front, over common-random-number scenario draws.
  - The evaluator computes it from fire perimeters and agent positions.
  - The fire model, the behavior model, the compliance model and *d* sit in the frozen judge.
- **Biggest risk:** judge validity.
  - Departure behavior [5] and fire spread drive the metric. If either is badly calibrated, the loop optimizes an artifact.
  - Mitigation: calibrate behavior on the survey data, and validate the coupled simulator against the NIST Camp Fire timeline [2] before freezing (inferred).
- **Why the runner-up lost:** EMS surge dispatch ties on total but loses on counterfactual leverage. Its baselines are already strong and simulation is already routine there, so the loop's distinctive contribution shows less. The deaths in its motivating event were also only weakly tied to dispatch [13]. Hurricane evacuation is the natural second case study, sharing traffic models with wildfire (inferred).

## Novelty status
**Partial overlap.** RAISE (arXiv 2606.31801) already pairs LLM heuristic design with worst-case instance search on online bin packing, job shop and VRP [1]. No work was found that combines:
- a regret (PAIRED-style) adversary [30];
- a calibrated emergency-logistics judge;
- per-decision counterfactual feedback;
- an agent-run autoresearch loop;
- a pre-registered one-shot holdout.

RAISE-style worst-case search should become an M4 ablation (inferred recommendation).

## Open questions
- Can WUI-NITY (or a lighter coupled model) run thousands of scenario draws per 30-minute iteration once fire spread is precomputed? (Criterion 8 is provisional; T6.)
- Is the NIST Camp Fire timeline [2] usable as quantitative validation data, or only qualitative?
- Does "expected exposure" need a severity weight, for example distance to the fire front, to be honest?
- Should EMS surge dispatch be kept as a second judge because its data is the best of all candidates?

## Sources
1. RAISE: LLM-based Automated Heuristic Design with Robust Adversary Instance Search, arXiv 2606.31801, 2026. https://arxiv.org/abs/2606.31801 (read: abstract page)
2. Maranghides A., Link E., Brown C.U., Walton W.D., Mell W., Hawks S., A Case Study of the Camp Fire: Notification, Evacuation, Traffic, and Temporary Refuge Areas (NETTRA), NIST Technical Note 2252, July 2023. https://www.nist.gov/publications/case-study-camp-fire-notification-evacuation-traffic-and-temporary-refuge-areas-nettra (read: publication page)
3. AP via PBS NewsHour, "Lahaina wildfire victims made it just blocks before becoming trapped by flames, report says", 2024-09-14 (on the Fire Safety Research Institute report for the Hawaii AG). https://www.pbs.org/newshour/nation/lahaina-wildfire-victims-made-it-just-blocks-before-becoming-trapped-by-flames-report-says (read)
4. Evacuation modelling for bushfire: the WUI-NITY simulation platform, Australian Journal of Emergency Management, October 2022. https://knowledge.aidr.org.au/resources/ajem-october-2022-evacuation-modelling-for-bushfire-the-wui-nity-simulation-platform/ (metadata only)
5. Wong S.D., Broader J.C., Walker J.L., Shaheen S.A., Understanding California wildfire evacuee behavior and joint choice making, Transportation 50(4):1165–1211, 2023. https://ideas.repec.org/a/kap/transp/v50y2023i4d10.1007_s11116-022-10275-y.html (metadata only)
6. University of Alabama staged wildfire evacuation model (UA news). https://news.ua.edu/?p=166266 (metadata only; the PreventionWeb copy returns 403 to scripts)
7. WUI-PEM: Wildfire Phased Zone Evacuation Methodology, ISCRAM Proceedings 2024. https://ojs.iscram.org/index.php/Proceedings/article/view/78 (metadata only)
8. Integration of simulation and optimization for evacuation planning (University of Melbourne, 2016). https://findanexpert.unimelb.edu.au/scholarlywork/1085313-integration-of-simulation-and-optimization-for-evacuation-planning (metadata only)
9. Public EMS datasets: NYC EMS Incident Dispatch Data (https://catalog.data.gov/dataset/ems-incident-dispatch-data); Austin-Travis County EMS incident data are used by OpenEMS (Ong et al. 2022) (the data.gov ATCEMS page returned 404 on 2026-10-29). (metadata only)
10. Ong J., Kulpanowski D., Xie Y., Nikolova E., Tran N.M., OpenEMS: an open-source package for two-stage stochastic and robust optimization for ambulance location and routing with applications to Austin-Travis County EMS data, 2022. https://arxiv.org/abs/2201.11208 (read: abstract page)
11. Maxwell M.S., Restrepo M., Henderson S.G., Topaloglu H., Approximate dynamic programming for ambulance redeployment, INFORMS Journal on Computing 22(2):266–281, 2010; Maxwell et al., A bound on the performance of an optimal ambulance redeployment policy, Operations Research 62(5):1014–1027, 2014. https://web.mit.edu/orc/www/archive/seminars/2009s/abs/Henderson_abs.html (metadata only)
12. Real-Time Ambulance Dispatching and Relocation, Manufacturing & Service Operations Management, 2018. https://pubsonline.informs.org/doi/epdf/10.1287/msom.2017.0649 (metadata only)
13. BC Government news release on the BC Coroners Service death review panel report "Extreme Heat and Human Mortality: A Review of Heat-Related Deaths in B.C. in Summer 2021", 2022-06-07. https://news.gov.bc.ca/releases/2022PSSG0042-000903 (read). (Replaces a CTV link that returned 404 on 2026-10-29.)
14. Wikipedia, "Hurricane Rita evacuation" (secondary; facts cross-check against NTSB and the Harris County Medical Examiner as cited there). https://en.wikipedia.org/wiki/Hurricane_Rita_evacuation (read)
15. Integrated optimization of staged evacuation and contraflow with a revised cell transmission model (UMD thesis, "An Integrated Optimal Control System for Emergency Evacuation"). https://drum.lib.umd.edu/handle/1903/7018 (metadata only)
16. Multistage stochastic programming for integrated hurricane evacuation and pre-positioning under forecast uncertainty (NSF PAR 10428837). https://par.nsf.gov/biblio/10428837 (metadata only)
17. Hurricane evacuation modeling: improvement and application of an integrated scenario-based evacuation framework (University of Delaware). https://udspace.udel.edu/items/7f6289f9-792b-45d6-9605-75be5186d70b (metadata only)
18. NBC News, "Report: FEMA fumbled in Puerto Rico after storms Irma, Maria", 2020-10-01 (on DHS OIG-20-76). https://www.nbcnews.com/news/latino/report-fema-fumbled-puerto-rico-after-storms-irma-maria-n1241755 (read). Primary: https://www.oversight.gov/sites/default/files/oig-reports/OIG-20-76-Sep20.pdf (PDF; metadata only)
19. Holguín-Veras J., Pérez N., Jaller M., Van Wassenhove L.N., Aros-Vera F., On the appropriate objective function for post-disaster humanitarian logistics models, Journal of Operations Management, 2013. https://courses.ie.bilkent.edu.tr/ie102/wp-content/uploads/sites/3/2017/11/Article-11_Deprivation-Costs.pdf (PDF; metadata only)
20. Lake C.K., A day like no other: the Las Vegas mass shooting lessons from America's largest mass casualty event, Trauma Surgery & Acute Care Open, 2025-04-14. https://pmc.ncbi.nlm.nih.gov/articles/PMC12094114 (read)
21. Mills A.F., Argon N.T., Ziya S., Resource-based patient prioritization in mass-casualty incidents, Manufacturing & Service Operations Management 15(3):361–377, 2013. https://ideas.repec.org/a/inm/ormsom/v15y2013i3p361-377.html (metadata only)
22. Mills A.F., Argon N.T., Ziya S., Dynamic distribution of patients to medical facilities in the aftermath of a disaster, Operations Research. https://academicnewsletter.sufe.edu.cn/info/402622 (metadata only)
23. Sacco Triage Method: RPM-Age survival estimates from 76,444 Pennsylvania Trauma Outcome Study patients; Delphi deterioration rates; linear programming. Prehospital and Disaster Medicine abstracts K115/K116. https://www.cambridge.org/core/services/aop-cambridge-core/content/view/CE24AF5F18B0093DD704489BEF69BB91/S1049023X00056740a.pdf/k116-an-objective-comparison-of-the-start-triage-protocols-and-the-sacco-triage-method.pdf (PDF; metadata only)
24. Semafor, "South Korea police admit to failures over Halloween crush", 2022-11-01; Al Jazeera, Korea Times coverage. https://www.semafor.com/article/11/01/2022/south-korea-police-admit-to-failures-over-halloween-crush (metadata only)
25. Helbing D., Mukerji P., Crowd disasters as systemic failures: analysis of the Love Parade disaster, EPJ Data Science, 2012 (ScienceDaily summary). https://www.sciencedaily.com/releases/2012/06/120626092625.htm (read); preprint https://arxiv.org/abs/1206.5856 (metadata only)
26. Pedestrian Crowd Management Experiments: A Data Guidance Paper, Collective Dynamics. https://www.collective-dynamics.eu/index.php/cod/article/view/A141 (metadata only)
27. Brown L.M., Dosa D.M., Thomas K., Hyer K., Feng Z., Mor V., The effects of evacuation on nursing home residents with dementia, American Journal of Alzheimer's Disease and Other Dementias, 2012. https://pmc.ncbi.nlm.nih.gov/articles/PMC3711109 (read)
28. This repository: `research/results.md` (v0-mini results, E1 dev estimate, validation table) and `docs/failure-modes.md`; README references Gao et al. 2016, MassDOT 2018, Bish 2011. (read)
29. This repository: `experiments/results/dev-selection.md`, `ops/reports/002-transit-v0-and-backbones.md`, and `experiments/results/dev-evac-*/summary.json`. (read)
30. Dennis M., Jaques N., Vinitsky E., Bayen A., Russell S., Critch A., Levine S., Emergent Complexity and Zero-shot Transfer via Unsupervised Environment Design, NeurIPS 2020. https://arxiv.org/abs/2012.02096 (metadata only)
