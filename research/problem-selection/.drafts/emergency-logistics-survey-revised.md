# Which emergency-logistics problem should the loop attack? A scored survey

## Executive summary
- **Eight candidates** were scored on the spec's 8-criterion scorecard, each 1–5, with every score tied to a cited source. All eight pass the hard filters (criteria 5 and 8 at 3 or above).
- **Adversarial verification of the top three changed four scores and the ranking** (see `emergency-logistics-survey-verification.md`). The new top three are EMS dispatch under surge (36), wildfire evacuation (35) and hurricane evacuation (34).
- **Recommendation: EMS dispatch and redeployment under surge.**
  - The loop metric is *acuity-weighted minutes beyond the response-time target*, summed over all calls.
  - The biggest risk is that the baselines are already very strong (approximate dynamic programming, real-time dispatch and relocation, and genetic-programming dispatch policies) [11][12][33], so the loop may not beat them.
- **Wildfire evacuation is one point behind** and is the natural second judge. It has higher stakes per event and higher counterfactual leverage.
- **Novelty is partial.**
  - LLM program search paired with an adversarial instance generator already exists (RAISE, 2026) [1].
  - Genetic programming has already been applied to EMS dispatch (GECCO 2023) [33].
  - The claim must therefore be narrowed to the full combination: a regret adversary, a calibrated emergency judge, per-decision counterfactual feedback, an agent-run loop and a pre-registered holdout.
- **The scores are coarse.** A 1–2-point gap is within judgment noise, so the top three are close (inferred).

## Ranked table (after verification)
| # | Candidate | 1 Stakes | 2 Recalc. | 3 Sim. | 4 CF lev. | 5 Metric | 6 Baseline | 7 Seq. | 8 Compute | Sum | Proposed loop metric | Biggest risk |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | EMS surge dispatch | 4 | 4 | 5 | 4 | 4 | 5 | 5 | 5 | **36** | acuity-weighted minutes beyond response target | very strong existing baselines, including genetic programming |
| 2 | Wildfire evacuation | 5 | 4 | 4 | 5 | 4 | 4 | 5 | 4 | **35** | expected person-minutes of fire exposure | fire-spread and departure-behavior model validity; WUI-NITY batch speed unverified |
| 3 | Hurricane evacuation | 5 | 4 | 4 | 5 | 3 | 5 | 5 | 3 | **34** | expected cost (exposure + false-alarm evacuation) | metric needs a contested weight; regional networks are heavy |
| 4 | Relief last mile | 4 | 4 | 3 | 4 | 4 | 4 | 5 | 5 | **33** | total deprivation cost | contested deprivation valuations; thin operational data |
| 5 | MCI patient distribution | 3 | 4 | 3 | 4 | 4 | 4 | 5 | 5 | **32** | expected survivors | expert-elicited deterioration curves; self-transport |
| 6 | Crowd crush | 5 | 4 | 3 | 4 | 4 | 3 | 5 | 3 | **31** | person-seconds above critical density | crush-regime physics unvalidated; microsimulation cost |
| 7 | Healthcare-facility evacuation | 4 | 4 | 3 | 4 | 3 | 4 | 4 | 5 | **31** | expected excess deaths (transfer + exposure) | weak outcome models for transfer harm |
| 8 | Venue/transit evacuation (CAGES) | 3 | 3 | 5 | 3 | 3 | 4 | 3 | 5 | **29** | seat-to-board time + density exposure | low decision leverage; density capped by construction |

**Changes from the scored draft:**
- EMS: criterion 1 3→4 and criterion 2 3→4;
- wildfire: criterion 6 3→4;
- hurricane: criterion 6 4→5.

Ranks 4–8 were not re-verified. Crowd crush beats healthcare-facility evacuation on the tie-break (criterion 1, 5 vs 4).

## Per-candidate rationale
- **EMS surge dispatch.**
  - The best data and tools: public dispatch data that spans a real surge (NYC's COVID-19 peak of 7,253 calls on 2020-03-30, with waits of 3–4 hours) [9][32], open simulators (OpenEMS, an RL benchmark) [10], and very strong baselines [11][12][33].
  - The harm is large and chronic. In England, handover delays over an hour rose from rare in 2011 to 14% of handovers in 2022–23, a decade after a "Zero Tolerance" policy, and are linked to serious harm and death [31].
  - Stakes stop at 4: in the B.C. heat dome most of the 619 deaths were older people at home alone, so dispatch is a weak lever there [13]. Deaths from handover delays are not quantified [31].
- **Wildfire evacuation.**
  - Most deaths happened during flight: 85 in the Camp Fire, where NIST documents 31 temporary refuge areas and at least 1,000 rescued [2]; at least 102 in Lahaina, where more than 60% of victims tried to flee and road blockages and locked gates trapped them [3].
  - An open coupled fire, pedestrian and traffic platform exists (WUI-NITY) [4][36], plus behavior survey data [5] and a 2,600-point validation timeline [2].
  - An adopted practice tool (Genasys Protect, formerly Zonehaven, in 24 California counties) [35] and research methods [6][7][8] provide baselines.
  - Order timing is the classic counterfactual that logs can't show.
- **Hurricane evacuation.**
  - Rita's evacuation killed 107, more than the storm, including heat deaths in gridlock and a bus fire [14].
  - The baselines are the strongest: HURREVAC times evacuation orders from clearance times and is used by 30,000+ emergency managers [37], alongside cell-transmission optimization, multistage stochastic programming and hazard trees [15][16][17].
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
  - Its own results show low decision leverage and a density metric capped by construction [29].

## Dropped by hard filter
None. The lowest criterion-5 and criterion-8 scores are 3.

## Recommendation
- **Problem:** EMS dispatch and redeployment for a city system under demand surge, including hospital offload delays. The first judge would be NYC, calibrated on public dispatch data that spans the 2020 surge [9][32].
- **Single loop metric:** *acuity-weighted minutes beyond the response-time target*, summed over all calls (inferred proposal).
  - The minutes beyond target include time spent waiting for an ambulance blocked at hospital offload.
  - Weights rise with acuity but stay above zero for every call, so neglecting low-acuity calls is penalized.
  - The weights, the targets and the offload model sit in the frozen judge.
- **Biggest risk: the baselines are already very strong** [11][12][33]. Genetic-programming dispatch policies (GECCO 2023) [33] must be a baseline, and the honest outcome may be "no improvement".
- **A secondary risk:** response time is a proxy for patient outcome.
- **Why the runner-up lost:** wildfire is one point lower. It has weaker simulability (unverified batch speed and judge validity) and weaker baselines than EMS, though higher stakes per event and higher counterfactual leverage. A 1-point gap is within noise, so choosing wildfire on societal salience would be defensible. It is the natural second judge (inferred).

## Novelty status
**Partial overlap.**
- RAISE (arXiv 2606.31801) already pairs LLM heuristic design with worst-case instance search on online bin packing, job shop and VRP [1].
- Genetic programming has already evolved EMS dispatch policies (GECCO 2023) [33], and agentic-AI genetic programming exists for simulation-based scheduling [34].
- No work was found that combines:
  - a regret (PAIRED-style) adversary [30];
  - a calibrated emergency-logistics judge;
  - per-decision counterfactual feedback;
  - an agent-run autoresearch loop;
  - a pre-registered one-shot holdout.
- RAISE-style worst-case search and genetic-programming hyper-heuristics should both become M4 ablations or baselines (inferred recommendation).

## Open questions
- **EMS:** does NYC's public dispatch data include enough fields (unit assignment, travel, at-hospital times) to calibrate offload delays? Not checked in this survey.
- **EMS:** which acuity weights and targets are defensible? This needs a clinical source before M3.
- **Wildfire (second judge):** can WUI-NITY, or a lighter coupled model, run thousands of scenario draws per 30-minute iteration with cached fire spread?
- **Overall:** should Dylan prefer wildfire for its per-event stakes and counterfactual leverage despite the 1-point gap? This is a judgment call that the scorecard doesn't settle.

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
31. Association of Ambulance Chief Executives, "New report warns there is no room for complacency over hospital handover delays that continue to cause significant harm to patients" (*Taking Stock*, September 2023). https://aace.org.uk/news/new-report-warns-there-is-no-room-for-complacency-over-hospital-handover-delays-that-continue-to-cause-significant-harm-to-patients/ (read)
32. NY1, "EMS workers face down challenges amid record 911 calls during coronavirus pandemic", 2020-04-03. https://ny1.com/nyc/all-boroughs/news/2020/04/03/ems-workers-face-down-challenges-amid-record-911-calls-during-coronavirus-pandemic (metadata only)
33. MacLachlan J., Mei Y., Zhang F., Zhang M., Signal J., Learning Emergency Medical Dispatch Policies Via Genetic Programming, GECCO 2023. https://api.openalex.org/works/doi:10.1145/3583131.3590434 (read: OpenAlex record)
34. Accelerated Genetic Programming Hyper-Heuristics for Simulation-Based Scheduling via Agentic AI, arXiv 2608.19487. https://arxiv.org/abs/2608.19487 (metadata only)
35. Genasys, "Genasys Inc. adds four more California counties to Zonehaven evacuation management contracts" and related releases. https://genasys.com/press-releases/genasys-inc-adds-four-more-california-counties-to-zonehaven-evacuation-management-contracts (metadata only)
36. Lund University (LTH), "New tool for wildfire evacuation simulation receives prestigious award". https://www.lth.se/english/article/new-tool-for-wildfire-evacuation-simulation-receives-prestigious-award/ (metadata only)
37. Dewberry, "Georgia Hurricane Evacuation Study and its impact on the 2024 Atlantic hurricane season", 2024-07-03. https://dewberry.com/insights-news/post/blog/2024/07/03/georgia-hurricane-evacuation-study-and-its-impact-on-the-2024-atlantic-hurricane-season (read)
