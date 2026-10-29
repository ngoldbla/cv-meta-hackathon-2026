# Patient distribution after a mass-casualty incident

## Decision problem
**Who decides:** EMS command, together with hospitals. In the first hours after a mass-casualty incident (MCI) they decide:
- which casualties to transport first;
- by which ambulance;
- to which hospital.

**Under what uncertainty:**
- each casualty's deterioration;
- hospital capacity;
- self-transported patients arriving outside EMS control [S1][S3].

## 1 Stakes
- **2017 Las Vegas shooting:** over 800 people injured, and 413 with gunshot wounds needing immediate treatment [S1]. The shooting killed 58 people (search metadata [S2]).
- **The nearest hospital was overwhelmed:** about 800 injured people organized their own transport, with mapping apps or ride-sharing to the nearest hospitals. One hospital had a line of private vehicles more than a quarter mile long, and another treated 124 gunshot wounds in under 24 hours [S1].
- **Harm attributable to distribution is poorly quantified:** no source found estimates the deaths caused by maldistribution, as opposed to deaths at the scene (inferred: absence in the searches logged).

## 2 Recalcitrance
- **Fixed-priority triage persists.** START, the most widely used MCI triage standard, uses a fixed priority order that ignores resource limits. A resource-based policy from a fluid model beat START in every scenario tested [S4], yet START remains standard.
- **Plans assume coordination that doesn't happen.** Plans assume EMS triages in the field and coordinates distribution. In Las Vegas that assumption "proved invalid" [S1].

## 3 Simulability
- **Survival models:**
  - survival probabilities from the RPM-Age score, calibrated on 76,444 blunt-injury patients (Pennsylvania Trauma Outcome Study);
  - deterioration rates from a Delphi expert consensus, in the Sacco Triage Method [S6].

  The deterioration side is the weak link.
- **Existing simulators:** discrete-event MCI distribution simulators exist, with modules for incident, rescue, triage, hospital selection and distribution, and hospital capacity from open government data [S7]. Hospital surge has also been modelled as a queueing network [S8].

## 4 Counterfactual leverage
- **Real outcomes come with no alternatives.** Each patient's outcome under a different destination or transport order is never observed. Replaying every option is exactly what logs cannot give.
- **Limited by the survival model.** The value depends on expert-elicited deterioration curves [S6] (inferred).

## 5 Honest loop metric
- **Candidate:** expected survivors under the frozen survival and deterioration model, as maximized by the Sacco method [S6] and by the patient-distribution heuristics [S5].
- **Gaming risks:**
  - exploiting the shape of the survival curves, for example deprioritizing severe patients;
  - ignoring self-transport.

  Both must sit in the frozen judge (inferred).

## 6 Baseline strength
- **Strong:**
  - resource-based prioritization [S4];
  - heuristic ambulance allocation and destination policies that beat nearest-facility transport [S5];
  - MIP formulations for joint dispatch, assignment and treatment order [S5].
- **Practice:** START, plus the nearest hospital.

## 7 Sequential decisions
- **Yes.** Each ambulance trip is a decision: hundreds per large MCI over the first hours [S1][S5].

## 8 Compute fit
- **Very cheap.** A discrete-event simulation with hundreds of patients, dozens of ambulances and a few hospitals runs in well under a second (inferred from model class [S7][S8]).

## Prior program search / adversarial environment work
- **None found** in these queries. The full check is in T3.
- **A caveat on leverage:** in Las Vegas most casualties self-transported, which limits what EMS distribution decisions control (inferred from [S1]).

## Provisional scores (1–5)
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| 3 | 4 | 3 | 4 | 4 | 4 | 5 | 5 |

## Sources
- [S1] Lake C.K., A day like no other: the Las Vegas mass shooting lessons from America's largest mass casualty event, Trauma Surgery & Acute Care Open, 2025-04-14. https://pmc.ncbi.nlm.nih.gov/articles/PMC12094114 (read)
- [S2] ASTHO, Public health and medical preparedness and response activities at the 2017 Route 91 Harvest Music Festival. https://www.astho.org/globalassets/report/public-health-and-medical-preparedness-and-response-activities-at-the-2017-route-91-harvest-music-festival.pdf (PDF; metadata only)
- [S3] Bulletin of the American College of Surgeons, Southern Nevada Trauma System uses proven techniques to save lives after 1 October shooting, March 2018. https://www.facs.org/for-medical-professionals/news-publications/news-and-articles/bulletin/2018/03/southern-nevada-trauma-system-uses-proven-techniques-to-save-lives-after-1-october-shooting (fetch returned no article text; metadata only)
- [S4] Mills A.F., Argon N.T., Ziya S., Resource-based patient prioritization in mass-casualty incidents, Manufacturing & Service Operations Management 15(3):361–377, 2013. https://ideas.repec.org/a/inm/ormsom/v15y2013i3p361-377.html (metadata only)
- [S5] Mills A.F., Argon N.T., Ziya S., Dynamic distribution of patients to medical facilities in the aftermath of a disaster, Operations Research. https://academicnewsletter.sufe.edu.cn/info/402622 (metadata only)
- [S6] Sacco Triage Method: RPM-Age survival estimates from 76,444 Pennsylvania Trauma Outcome Study patients; Delphi deterioration rates; linear programming. Prehospital and Disaster Medicine abstracts K115/K116. https://www.cambridge.org/core/services/aop-cambridge-core/content/view/CE24AF5F18B0093DD704489BEF69BB91/S1049023X00056740a.pdf/k116-an-objective-comparison-of-the-start-triage-protocols-and-the-sacco-triage-method.pdf (PDF; metadata only)
- [S7] Mass casualty distribution simulation with resilient hospital selection (EasyChair preprint 5Q2L). https://1easychair-www.easychair.org/publications/preprint/5Q2L/open (metadata only)
- [S8] Design of a model to predict surge capacity bottlenecks for burn mass casualties at a large academic medical center, Prehospital and Disaster Medicine (RAND EP51400). https://www.rand.org/pubs/external_publications/EP51400.html (metadata only)
