# Last-mile relief distribution after a disaster

## Decision problem
**Who decides:** relief agencies (FEMA, NGOs, the military), over days to weeks after a hurricane or earthquake. They decide:
- where to stage supplies;
- how to allocate food, water and medicine to points of distribution;
- how to route trucks (and drones) as road damage is discovered.

**Under what uncertainty:**
- demand;
- road and bridge status;
- supply arrivals [S3][S4][S5].

## 1 Stakes
- **Hurricane Maria (Puerto Rico, 2017):** the DHS Inspector General found FEMA lost visibility of nearly 40% of shipments worth more than $250 million, 98% of them meals and water [S2].
  - Shipments took more than two months on average to reach their final destination: about 71 days for water and 59 for food.
  - The first food and water arrived on average 10 days after the hurricanes.
  - 40% of municipalities reported problems with expired food [S2].
  - The OIG concluded FEMA "cannot ensure it provided commodities ... as needed to sustain life and alleviate suffering" [S2].
- **Deaths:** excess-death estimates for Maria range from about 1,400 to as many as about 8,500, many attributed to delayed medical care (search metadata [S6]). The share attributable to relief-supply logistics is not separated in these sources (inferred).

## 2 Recalcitrance
- **A known gap since 2013.** Holguín-Veras et al. argued that post-disaster models should minimize social cost: logistics cost plus *deprivation cost*, the economic value of suffering from lack of access, which grows convexly with deprivation time. Most models had used commercial cost or time objectives instead [S1].
- **Practice still failed.** Maria's distribution failures in 2017 came despite this literature [S2].

## 3 Simulability
- **Disaster-specific inputs.** Road damage and isolation scenarios, staging areas and points of distribution are specific to each disaster. Recent models represent isolated communities and heterogeneous ground and aerial fleets [S3].
- **Contested valuation.** Deprivation-cost functions have been estimated by discrete-choice methods [S7], but their parameters are contested (inferred).
- **Weak operational data.** As Maria shows, operational data on real distribution is poor, which limits calibration [S2].

## 4 Counterfactual leverage
- **High.** Allocation and routing alternatives under the same damage and demand realization are never observed. Road status is learned only along the routes actually driven (inferred, consistent with the endogenous-information models [S5]).

## 5 Honest loop metric
- **Candidate:** total deprivation cost, or social cost, over the horizon [S1]. It is a principled scalar with a literature behind it.
- **Risks:**
  - the valuation parameters are a modelling choice;
  - a loop could trade one community's long deprivation against many short ones, depending on convexity (inferred).

## 6 Baseline strength
- **Strong:**
  - multi-stage stochastic programs over road-network states [S4];
  - chance-constrained, CVaR and distributionally robust planning for isolated communities (MSOM 2024) [S3];
  - endogenous stochastic VRP with UAV damage surveys [S5].

## 7 Sequential decisions
- **Yes.** Daily or shift-level dispatch and allocation over days to weeks, while road status is revealed along the way [S4][S5].

## 8 Compute fit
- **Cheap.** A network-flow or routing simulation over a regional network with tens to hundreds of distribution points runs quickly (inferred).

## Prior program search / adversarial environment work
- **None found** in these queries. The full check is in T3.

## Provisional scores (1–5)
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| 4 | 4 | 3 | 4 | 4 | 4 | 5 | 5 |

## Sources
- [S1] Holguín-Veras J., Pérez N., Jaller M., Van Wassenhove L.N., Aros-Vera F., On the appropriate objective function for post-disaster humanitarian logistics models, Journal of Operations Management, 2013. https://courses.ie.bilkent.edu.tr/ie102/wp-content/uploads/sites/3/2017/11/Article-11_Deprivation-Costs.pdf (PDF; metadata only)
- [S2] NBC News, "Report: FEMA fumbled in Puerto Rico after storms Irma, Maria", 2020-10-01 (on DHS OIG-20-76). https://www.nbcnews.com/news/latino/report-fema-fumbled-puerto-rico-after-storms-irma-maria-n1241755 (read). Primary: https://www.oversight.gov/sites/default/files/oig-reports/OIG-20-76-Sep20.pdf (PDF; metadata only)
- [S3] Last-Mile Humanitarian Logistics Planning with Isolated Communities, Manufacturing & Service Operations Management, 2024. https://pubsonline.informs.org/doi/10.1287/msom.2024.1197 (metadata only)
- [S4] A multi-stage stochastic programming model for relief distribution considering the state of road network (Tongji). https://sem.tongji.edu.cn/semen/20447.html (metadata only)
- [S5] Endogenous stochastic optimisation for relief distribution assisted with unmanned aerial vehicles (Imperial College). https://spiral.imperial.ac.uk/entities/publication/0a47d3a7-f2f2-4258-bbf9-914fb566d90c (metadata only)
- [S6] Excess-death estimates for Hurricane Maria (Puerto Rico government figure ~1,427; Harvard study up to ~8,500), as summarized in news coverage. https://upfront.scholastic.com/issues/2018-19/091718/puerto-rico-one-year-later.html (metadata only)
- [S7] Discrete choice approach for assessing deprivation cost in humanitarian relief operations. https://redcol.minciencias.gov.co/Record/RCUC2_cab1edbb3fd92a562227e22da6719120/Description (metadata only)
