# EMS dispatch and redeployment under surge

## Decision problem
**Who decides:** 911 and EMS dispatch centers, minute by minute during a demand surge (a heat wave, a pandemic wave or a disaster). They decide:
- which ambulance answers which call;
- whether and how to prioritize or queue calls;
- where idle ambulances should wait (relocation or "move-up");
- how to cope with hospital offload delays.

**Under what uncertainty:**
- call volume and locations;
- service and offload times [S1][S4].

## 1 Stakes
- **2021 B.C. heat dome:** 619 heat-related deaths, out of more than 800 deaths reported from June 25 to July 1 [S1].
  - 911 calls doubled at the peak.
  - Paramedics attended 54% of the heat-dome cases, with a median response time of 10 min 25 s.
  - In 17 instances callers were left on hold for an extended period, and in 6 they were told no ambulance was available [S1].
  - Coverage reported waits of hours for an ambulance, and up to 11-hour waits for hospital transfer (metadata [S2]).
- **EMS dispatch is a minor lever on these deaths** (inferred from [S1]):
  - 98% of the deaths happened indoors;
  - 67% of the dead were 70 or older;
  - 56% lived alone.

## 2 Recalcitrance
- **Heavily studied for normal operations:**
  - approximate dynamic programming (ADP) for ambulance redeployment since 2010 [S3];
  - bounds on the optimal redeployment policy [S3];
  - real-time joint dispatch and relocation (MSOM 2017) [S4];
  - newer optimization-augmented machine learning (2025) [S5].
- **Surge regimes are less studied:** demand far above normal, plus hospital offload delays (inferred). Those policies are tuned to normal demand (inferred).

## 3 Simulability
- **Excellent public data:**
  - NYC EMS Incident Dispatch Data;
  - San Francisco 911 medical-incident data;
  - Austin-Travis County EMS incidents for 2019–2020 [S6].
- **Open tools:** OpenEMS is an open-source pipeline (data handling, optimization and a calibrated simulation) built on Austin-Travis County EMS data [S7]. A benchmark environment for dynamic ambulance redeployment, built on San Francisco data and designed for RL, also exists [S6].

## 4 Counterfactual leverage
- **Medium to high.** Alternative dispatch and relocation decisions are unobserved in the logs.
- **But this field already evaluates by simulation routinely** [S3][S7], so the counterfactual-data advantage is less novel here (inferred).

## 5 Honest loop metric
- **Candidates:** the fraction of urgent calls reached within a target time, or P90 response time. A survival-weighted response (for example, a cardiac-arrest survival curve as a function of response time) is also possible (inferred standard).
- **Gaming risks:**
  - neglecting low-priority calls;
  - exploiting the offload model (inferred).

## 6 Baseline strength
- **Very strong:** ADP redeployment [S3], real-time dispatch and relocation [S4], ML-augmented optimization [S5], and two-stage stochastic and robust location [S7].

## 7 Sequential decisions
- **Yes, and densely:** hundreds to thousands of dispatch and relocation decisions per day (inferred from data scale [S6]).

## 8 Compute fit
- **Cheap.** A discrete-event simulation of a city EMS system runs quickly. Existing RL benchmark environments are designed to scale [S6].

## Prior program search / adversarial environment work
- **RL and ML exist** for ambulance redeployment [S5][S6].
- **The method doesn't:** no LLM program search or regret-based adversarial demand generation was found in these queries. The full check is in T3.

## Provisional scores (1–5)
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| 3 | 3 | 5 | 4 | 4 | 5 | 5 | 5 |

## Sources
- [S1] BC Government news release on the BC Coroners Service death review panel report "Extreme Heat and Human Mortality: A Review of Heat-Related Deaths in B.C. in Summer 2021", 2022-06-07. https://news.gov.bc.ca/releases/2022PSSG0042-000903 (read). (Replaces a CTV link that returned 404 on 2026-10-29.)
- [S2] Squamish Chief, "B.C. heat wave leads to 11-hour ambulance wait time, spike in sudden deaths", 2021. https://squamishchief.com/bc-news/bc-heat-wave-leads-to-11-hour-ambulance-wait-time-spike-in-sudden-deaths-3918823 (metadata only)
- [S3] Maxwell M.S., Restrepo M., Henderson S.G., Topaloglu H., Approximate dynamic programming for ambulance redeployment, INFORMS Journal on Computing 22(2):266–281, 2010; Maxwell et al., A bound on the performance of an optimal ambulance redeployment policy, Operations Research 62(5):1014–1027, 2014. https://web.mit.edu/orc/www/archive/seminars/2009s/abs/Henderson_abs.html (metadata only)
- [S4] Real-Time Ambulance Dispatching and Relocation, Manufacturing & Service Operations Management, 2018. https://pubsonline.informs.org/doi/epdf/10.1287/msom.2017.0649 (metadata only)
- [S5] Optimization-Augmented Machine Learning for Vehicle Operations in Emergency Medical Services, arXiv 2503.11848. https://arxiv.org/abs/2503.11848 (metadata only)
- [S6] Public EMS datasets: NYC EMS Incident Dispatch Data (https://catalog.data.gov/dataset/ems-incident-dispatch-data); Austin-Travis County EMS incident data are used by OpenEMS (Ong et al. 2022) (the data.gov ATCEMS page returned 404 on 2026-10-29). (metadata only)
- [S7] Ong J., Kulpanowski D., Xie Y., Nikolova E., Tran N.M., OpenEMS: an open-source package for two-stage stochastic and robust optimization for ambulance location and routing with applications to Austin-Travis County EMS data, 2022. https://arxiv.org/abs/2201.11208 (read: abstract page)
