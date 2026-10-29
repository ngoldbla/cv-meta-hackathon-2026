# Hurricane phased evacuation with contraflow

## Decision problem
**Who decides:** state and county officials, over the 1–3 days before landfall. They decide:
- which zones to order out, and when;
- whether and where to run contraflow (reversing inbound lanes to carry outbound traffic);
- how to stage fuel, buses and shelters.

**Under what uncertainty:**
- the storm's track and intensity, given in forecasts that are updated every few hours;
- how many people leave (including "shadow" evacuees outside the ordered zones);
- road capacity [S3][S4].

## 1 Stakes
- **Hurricane Rita (2005, Texas):** 2.5–3.7 million people evacuated in about 1.7 million vehicles, against an anticipated 445,000 [S1].
- **The evacuation killed more people than the storm:** 107 evacuees died during the evacuation itself, more than Rita's direct impacts [S1]. Of those deaths:
  - 23 died in a motorcoach fire on I-45 while evacuating nursing-home residents;
  - 46 died from heat, found unresponsive in vehicles stuck in congestion (in-vehicle temperatures up to 112 °F);
  - 10 died during health-facility evacuations [S1].
- **Travel times:** 12–36 hours, and 18–25 hours from Houston to Dallas [S1][S2].
- **Contraflow came late:** it was approved on Sept 22 and took about 12 hours to implement fully [S1].

## 2 Recalcitrance
- **Decades of operations research:**
  - optimal scheduling of zone orders and contraflow crossovers [S3];
  - actionable joint evacuation-scheduling and contraflow plans [S5];
  - multistage stochastic programs that combine evacuation with pre-positioning and model forecast errors as a Markov chain [S6];
  - scenario-based "hazard tree" frameworks for when to order an evacuation [S7].
- **Practice still misfires:**
  - Rita's over-evacuation and gridlock [S1];
  - the 2017 debate over why Houston did not order an evacuation for Harvey [S2].
- **Adoption is the gap.** The Texas response after Rita was logistic (fuel, water and medical support along routes) rather than a decision tool [S1].

## 3 Simulability
- **Traffic models:** cell transmission models (CTM, mesoscopic) are standard for evacuation networks and have been validated against microscopic VISSIM [S3]. Road networks come from OpenStreetMap (inferred standard practice).
- **Hazard uncertainty:** National Hurricane Center forecast errors have been modelled as a Markov chain for stochastic programming [S6].
- **Behavior:** a meta-analysis of 38 actual-response and 11 hypothetical studies gives effect sizes for who evacuates [S8].

## 4 Counterfactual leverage
- **High.** Each storm is observed once, under one set of order times and contraflow choices.
- **What replay adds:** replaying many storm tracks (drawn from forecast-error models) under every order schedule exposes the trade-off between over-evacuating and late evacuation. Logs cannot show it [S6][S7] (inferred).

## 5 Honest loop metric
- **Candidates:**
  - expected person-hours exposed (people still in surge zones at landfall, plus vehicle-hours in heat-stress congestion);
  - expected cost, combining exposure and false-alarm evacuation cost.
- **The difficulty:**
  - the two goals pull against each other (over-evacuation killed people in Rita [S1]), so a single scalar needs a weight that is itself a policy choice;
  - deaths are not simulated directly;
  - gaming: tuning the weight, or exploiting the behavior model (inferred).

## 6 Baseline strength
- **Strong.** Mature operations-research methods exist:
  - CTM-based optimization of staged evacuation and contraflow [S3][S5];
  - multistage stochastic programming [S6];
  - dynamic programming and hazard trees [S7].

## 7 Sequential decisions
- **Yes.** Repeated decisions over 1–3 days as each forecast cycle updates: zone orders, contraflow activation and staging [S6][S7].

## 8 Compute fit
- **Heavier than the alternatives.** A metro or regional network (Houston scale) over a multi-day horizon makes each scenario heavier than a town-scale model.
- **Feasible with a coarse model.** Mesoscopic CTM keeps it tractable, but a 30-minute iteration may allow only hundreds of scenarios, not thousands (inferred; to be checked in T6).

## Prior program search / adversarial environment work
- **None found** in these queries (LLM program search or regret-based scenario generation for hurricane evacuation). The full check is in T3.

## Provisional scores (1–5)
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| 5 | 4 | 4 | 5 | 3 | 4 | 5 | 3 |

## Sources
- [S1] Wikipedia, "Hurricane Rita evacuation" (secondary; facts cross-check against NTSB and the Harris County Medical Examiner as cited there). https://en.wikipedia.org/wiki/Hurricane_Rita_evacuation (read)
- [S2] Texas Tribune, "The Road from Rita: Will Another Traffic Nightmare Precede the Next Big Storm?" https://apps.texastribune.org/road-from-rita/ (metadata only)
- [S3] Integrated optimization of staged evacuation and contraflow with a revised cell transmission model (UMD thesis, "An Integrated Optimal Control System for Emergency Evacuation"). https://drum.lib.umd.edu/handle/1903/7018 (metadata only)
- [S4] NPR, "Gridlock hampers Texas evacuation efforts", 2005-09-23. https://www.npr.org/2005/09/23/4860470/gridlock-hampers-texas-evacuation-efforts (metadata only)
- [S5] NICTA evacuation planner: Actionable evacuation plans with contraflows (ANU). https://researchportalplus.anu.edu.au/en/publications/nicta-evacuation-planner-actionable-evacuation-plans-with-contraf/ (metadata only)
- [S6] Multistage stochastic programming for integrated hurricane evacuation and pre-positioning under forecast uncertainty (NSF PAR 10428837). https://par.nsf.gov/biblio/10428837 (metadata only)
- [S7] Hurricane evacuation modeling: improvement and application of an integrated scenario-based evacuation framework (University of Delaware). https://udspace.udel.edu/items/7f6289f9-792b-45d6-9605-75be5186d70b (metadata only)
- [S8] Huang S.-K., Lindell M.K., Prater C.S., Who Leaves and Who Stays? A Review and Statistical Meta-Analysis of Hurricane Evacuation Studies, Environment and Behavior 48(8):991–1029, 2016. https://digitalcommons.jsu.edu/fac_res/153 (metadata only)
