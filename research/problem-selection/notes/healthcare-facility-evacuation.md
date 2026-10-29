# Hospital and nursing-home evacuation

## Decision problem
**Who decides:** facility administrators and regional health coordinators, before and after a hurricane or flood. They decide:
- whether each hospital or nursing home evacuates or shelters in place;
- when;
- with which vehicles;
- to which receiving facilities.

**Under what uncertainty:**
- the hazard (surge, flood, power loss);
- the bed capacity of receiving facilities;
- the health risk that transfer itself poses to frail patients [S4][S5][S6].

## 1 Stakes
- **Hurricane Irma (2017):** a dozen deaths at the Rehabilitation Center at Hollywood Hills after a prolonged power failure cut its air conditioning. About 115 patients were then evacuated across the street [S1].
- **Hurricane Katrina (2005):** Memorial Medical Center flooded, lost power and generators, and evacuated patients by helicopter under extreme conditions. Deaths during the final hours of the evacuation became a criminal and civil case [S2].
- **Hurricane Rita (2005):** 23 nursing-home evacuees died in a bus fire during the evacuation (see `hurricane-evacuation.md` [S1] there).
- **Evacuating can itself raise mortality:**
  - for nursing-home residents with severe dementia during Hurricane Gustav (2008), evacuation raised 30-day mortality by 2.8 percentage points and 90-day mortality by 3.9 points (21,255 residents in 119 at-risk homes, difference-in-differences) [S3];
  - a multi-hurricane instrumental-variable study reports evacuation raising 90-day death from 2.7% to 5.3% among 36,389 residents (search metadata [S4]; to verify in T5).

## 2 Recalcitrance
- **A long-running dilemma.** Evacuate or shelter in place has been debated since Katrina and Rita. Universal evacuation policies conflict with the evidence that transfer harms frail residents [S3][S4].
- **Planning models exist, without visible adoption:**
  - patient allocation to receiving hospitals under bed and vehicle limits [S5];
  - multi-period robust and stochastic programs [S6].

  No source found shows them in routine use (inferred).

## 3 Simulability
- **Facilities:** public CMS data give facility locations and capacities (inferred standard source; not verified in these searches).
- **Health outcomes:** the transfer-harm estimates come from observational studies [S3][S4]. Clinical-level resident data (the Minimum Data Set) is restricted (inferred).
- **Hazard:** power-loss and heat hazards can be simulated, but calibrating facility-level failure probabilities is thin (inferred).

## 4 Counterfactual leverage
- **High in principle.** For each facility, the counterfactual "had it sheltered instead" is never observed. The studies above can only estimate it statistically [S3][S4].
- **Limited by the outcome model.** The simulated outcome model inherits those statistical estimates (inferred).

## 5 Honest loop metric
- **Candidate:** expected excess deaths, combining transfer harm with hazard exposure among those who sheltered.
- **The difficulty:** both terms rest on weakly calibrated outcome models. A loop could "win" by exploiting the relative shapes of the two (inferred).

## 6 Baseline strength
- **Moderate to strong:**
  - Bish et al. (2014) allocation of patients to receiving hospitals under bed and vehicle limits [S5];
  - temporary care centers as a second kind of destination [S5];
  - multi-period robust and possibilistic programming [S6];
  - Virginia Tech optimization-based logistics planning for hospital evacuation [S7].

## 7 Sequential decisions
- **Partly.** The decision to evacuate or shelter is made once per facility, then dozens to hundreds of transport trips follow over a day or more (inferred from [S5][S6]).

## 8 Compute fit
- **Cheap.** A regional set of facilities, vehicles and receiving beds is small. Discrete-event or flow simulation should run in seconds (inferred).

## Prior program search / adversarial environment work
- **None found** in these queries. The full check is in T3.

## Provisional scores (1–5)
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| 4 | 4 | 3 | 4 | 3 | 4 | 4 | 5 |

## Sources
- [S1] NBC News and others, "Eight dead at Hollywood, Florida, nursing home after Irma cut power", Sept 2017, with later reports of 12 deaths. https://www.nbcnews.com/storyline/hurricane-irma/eight-dead-hollywood-florida-nursing-home-after-irma-cut-power-n800931 (metadata only)
- [S2] ProPublica, "The Deadly Choices at Memorial", 2009. https://www.propublica.org/article/the-deadly-choices-at-memorial-826 (metadata only)
- [S3] Brown L.M., Dosa D.M., Thomas K., Hyer K., Feng Z., Mor V., The effects of evacuation on nursing home residents with dementia, American Journal of Alzheimer's Disease and Other Dementias, 2012. https://pmc.ncbi.nlm.nih.gov/articles/PMC3711109 (read)
- [S4] Dosa D. et al., To evacuate or shelter in place: implications of universal hurricane evacuation policies on nursing home residents, Journal of the American Medical Directors Association, 2012. https://bibliography.interrai.org/node/47562 (metadata only)
- [S5] Bish D.R., Agca E., Glick R., Decision support for hospital evacuation and emergency response (patient allocation to receiving hospitals and temporary care centers). https://par.nsf.gov/servlets/purl/10291201 (metadata only)
- [S6] A robust possibilistic programming approach to multiperiod hospital evacuation planning problem under uncertainty. https://international.vlex.com/vid/robust-possibilistic-programming-approach-855651361 (metadata only)
- [S7] Optimization-based Logistics Planning and Performance Measurement for Hospital Evacuation and Emergency Management (Virginia Tech dissertation). https://vtechworks.lib.vt.edu/handle/10919/51551 (metadata only)
