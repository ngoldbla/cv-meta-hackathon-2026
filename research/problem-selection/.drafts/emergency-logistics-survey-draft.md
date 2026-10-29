# Which emergency-logistics problem should the loop attack? A scored survey

## Executive summary
- **Eight candidates** were scored on the spec's 8-criterion scorecard, each 1–5, with every score tagged to a source in `notes/`. All eight pass the hard filters (criteria 5 and 8 at 3 or above).
- **Top three:** wildfire evacuation timing and zone sequencing (34), EMS dispatch under surge (34; it loses the tie-break on counterfactual leverage), and hurricane phased evacuation (33).
- **Recommendation: wildfire evacuation**, with the loop metric *expected person-minutes of fire exposure* and the biggest risk being the validity of the fire-spread and departure-behavior models in the frozen judge.
- **Novelty is partial** [M-M4]. LLM program search with an adversarial instance generator already exists (RAISE, 2026). Our claim must be narrowed to the regret adversary, a calibrated emergency judge, per-decision counterfactual feedback and a pre-registered holdout.
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
  - Most deaths happened during flight: 85 deaths in the Camp Fire, where NIST documents 31 temporary refuge areas and at least 1,000 rescued [WF-S2]; at least 102 in Lahaina, where more than 60% of victims tried to flee and road blockages and locked gates trapped them [WF-S5].
  - Open coupled fire/pedestrian/traffic simulation exists (WUI-NITY) [WF-S11], plus behavior survey data [WF-S12] and a 2,600-point validation timeline [WF-S2].
  - Order timing is the classic counterfactual that logs can't show, and staged evacuation is known to matter [WF-S9].
  - Baselines are credible but not standardized [WF-S7][WF-S10].
- **EMS surge dispatch.**
  - The best data and tools: public dispatch datasets and open simulators (OpenEMS, an RL benchmark) [EMS-S6][EMS-S7], and very strong ADP and MSOM baselines [EMS-S3][EMS-S4].
  - But in the heat dome most of the 619 deaths were older people at home alone, so dispatch is a minor lever on them [EMS-S1]. Routine simulation also reduces the novelty of counterfactual data (inferred).
- **Hurricane evacuation.**
  - Rita's evacuation killed 107, more than the storm, including heat deaths in gridlock and a bus fire [HU-S1].
  - Strong operations-research baselines exist (CTM optimization, multistage stochastic programming, hazard trees) [HU-S3][HU-S6][HU-S7].
  - But the metric must trade exposure against false-alarm evacuation, and regional networks are heavy (inferred).
- **Relief last mile.**
  - Maria: shipments took more than two months on average, and visibility was lost on nearly 40% of them [RL-S2].
  - Deprivation cost gives a principled objective [RL-S1], but the valuations are contested and operational data is thin (inferred).
- **MCI patient distribution.**
  - The nearest hospitals were overwhelmed by about 800 self-transported casualties in Las Vegas [MCI-S1].
  - Strong policies beat START [MCI-S4][MCI-S5], but the outcome model rests on expert-elicited deterioration curves [MCI-S6].
- **Crowd crush.**
  - The highest stakes per incident: 159 dead at Itaewon, where police had 11 warning calls [CC-S1].
  - The physics is understood [CC-S3] and the data is open [CC-S6], but the crush regime is unvalidated and microsimulation at scale is expensive (inferred).
- **Healthcare-facility evacuation.**
  - Evacuation itself raises mortality: +3.9 points at 90 days for residents with severe dementia [HC-S3].
  - But outcome models are observational and weak (inferred).
- **Venue/transit evacuation (CAGES).**
  - The best-calibrated simulator and the cheapest compute [VT-S1].
  - Its own results show low decision leverage (the model adds −3.45% beyond staging) and a density metric capped by construction [VT-S3].

## Dropped by hard filter
None. The lowest criterion-5 and criterion-8 scores are 3 (hurricane, healthcare, CAGES; crowd crush, hurricane).

## Recommendation
- **Problem:** wildfire evacuation timing and zone sequencing for a WUI community.
- **Single loop metric:** *expected person-minutes of fire exposure.* Summed over evacuees, it counts the minutes each person spends on a road segment or in a zone within distance *d* of the simulated fire front, over common-random-number scenario draws.
  - The evaluator computes it from fire perimeters and agent positions.
  - The fire model, the behavior model, the compliance model and *d* sit in the frozen judge.
- **Biggest risk:** judge validity.
  - Departure behavior [WF-S12] and fire spread drive the metric. If either is badly calibrated, the loop optimizes an artifact.
  - Mitigation: calibrate behavior on the survey data, and validate the coupled simulator against the NIST Camp Fire timeline [WF-S2] before freezing (inferred).
- **Why the runner-up lost:** EMS surge dispatch ties on total but loses on counterfactual leverage. Its baselines are already strong and simulation is already routine there, so the loop's distinctive contribution shows less. The deaths in its motivating event were also only weakly tied to dispatch [EMS-S1]. Hurricane evacuation is the natural second case study, sharing traffic models with wildfire (inferred).

## Novelty status
**Partial overlap.** RAISE (arXiv 2606.31801) already pairs LLM heuristic design with worst-case instance search on online bin packing, job shop and VRP [M-M4]. No work was found that combines:
- a regret (PAIRED-style) adversary [M-M3];
- a calibrated emergency-logistics judge;
- per-decision counterfactual feedback;
- an agent-run autoresearch loop;
- a pre-registered one-shot holdout.

RAISE-style worst-case search should become an M4 ablation (inferred recommendation).

## Open questions
- Can WUI-NITY (or a lighter coupled model) run thousands of scenario draws per 30-minute iteration once fire spread is precomputed? (Criterion 8 is provisional; T6.)
- Is the NIST Camp Fire timeline [WF-S2] usable as quantitative validation data, or only qualitative?
- Does "expected exposure" need a severity weight, for example distance to the fire front, to be honest?
- Should EMS surge dispatch be kept as a second judge because its data is the best of all candidates?
