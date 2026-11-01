# M3: EMS surge-dispatch judge: design

Date: 2026-11-01 · Status: draft for review · Author: Dylan Goldblatt
Parent design: `docs/superpowers/specs/2026-10-29-emergency-logistics-loop-design.md` (M3 row of §8; the CAGES move in §7.6).
Problem choice: `research/problem-selection/emergency-logistics-survey-brief.md` (Dylan picked EMS surge dispatch on 2026-10-29).

*Safety scope: simulation research only. Nothing here certifies a dispatch policy, a response-time standard or a triage protocol.*

## 1. Goal
Build and freeze a calibrated, replayable simulator of New York City EMS under demand surge, with an evaluator and a sealed holdout. Every later loop (red and blue) is scored against it. M3 runs no loops and touches no holdout. It delivers the judge, its anchors and its compute gate.

## 2. Decisions already made
| Decision | Choice |
|---|---|
| Levers | Dispatch (queue priority, unit choice, relocation) **and** surge levers (activate extra units under a budget; divert tier-3 calls to secondary triage) |
| Metric | Tiered acuity-weighted lateness. Targets and weights come from published standards, and any claim must also hold under two alternative weightings |
| Approach | Replay real NYC days, calibrated on 2017–2019 logs. Perturbations stay inside bounds set from pre-2020 data and the literature |
| Holdout | Sealed: two real surges, a stress pool and a normal pool |
| Layout | A new shared `loopkit/` harness. CAGES moves to `judges/cages/` and EMS lives in `judges/ems/`, all in one maintainer unlock |

## 3. The data (measured 2026-10-29)

**The source:** NYC Open Data *EMS Incident Dispatch Data*, Socrata id `76xm-jjuj`.
- 30,389,767 incidents from 2005-01-01 to 2026-09-30, or 1.1–1.6 million a year.
- Fields used, one row per incident:
  - `incident_datetime`;
  - `initial_call_type` and `initial_severity_level_code` (severity 1–8);
  - `final_*`, kept for analysis only;
  - `first_assignment_datetime`, `dispatch_response_seconds_qy`, `first_on_scene_datetime`, `incident_response_seconds_qy` and `incident_travel_tm_seconds_qy`;
  - `first_to_hosp_datetime`, `first_hosp_arrival_datetime` and `incident_close_datetime`;
  - `held_indicator`;
  - `borough`, `incident_dispatch_area` and `zipcode`;
  - the valid-time indicators;
  - `reopen`, `standby`, `transfer` and `special_event`.
- **Absent:** unit IDs, hospital IDs and coordinates finer than the zip code.

**The surge is visible in the data:**

| | 2019-03-28 (normal) | 2020-03-30 (COVID wave 1 peak) |
|---|---|---|
| Incidents | 4,214 | 6,527 |
| Held-call share | 8% | 43% |
| Dispatch delay p90 | 2.0 min | 114.2 min |
| Hospital arrival → close, median / p90 | 34.7 / 47.3 min | 41.4 / 62.0 min |
| Response p90, severity 1 / 2 / 4 / 6 | 10.2 / 11.3 / 19.1 / 22.2 min | 16.2 / 29.1 / 73.8 / 336.2 min |

The held-call share rose from 3–12% on 2019-03-20…04-05 to 18–43% on 2020-03-20…04-05. The queries are reproducible with SoQL against `76xm-jjuj`, and the commands are in the plan.

## 4. Architecture
```
loopkit/                 NEW shared harness (frozen): ledger.py, stats.py (paired Wilcoxon, bootstrap CI, Holm), root marker lookup
judges/cages/            CAGES, moved; import name `cages`; its frozen ledger/stats become thin re-exports of loopkit
judges/ems/              NEW judge, Python package `ems`
  ems/data/              Socrata ingest → local cache (Parquet) verified against committed manifests (window, rows, SHA-256)
  ems/calibrate/         fits from 2017–2019; writes a frozen calibration bundle + fit report
  ems/sim/               event-driven simulator (calls, units, hospitals/offload, tours); clone + common random numbers
  ems/policy/            Policy API; baselines b0, b1; antagonist (omniscient b1)
  ems/scenarios/         trace-day sampler (editable by the red loop) + bounds.py (frozen)
  ems/evaluate.py        frozen evaluator: metric, paired tests, holdout gate
  ems/cf.py              counterfactual per-decision reports
  experiments/ar/ems_blue_bench.py   autoresearch benchmark (prints METRIC line)
  tests/                 anchors + simulator invariants
```

**One maintainer unlock.** `maintainer/apply-m3.sh` follows the `apply-v2.sh` pattern: it is tested in a throwaway copy first, and Dylan runs it. It:
1. creates `loopkit/`, makes CAGES's `ledger.py` and the statistics in `evaluate.py` re-export from it, and moves CAGES to `judges/cages/` (the import name stays `cages`);
2. makes `loopkit.ledger` find the repository root by a marker file (`AGENTS.md`), so `research/ledger.jsonl` stays the single program ledger;
3. rewrites `scripts/guard_paths.py` with a frozen list per judge: CAGES's four paths at their new locations, plus `loopkit/*`, `judges/ems/ems/evaluate.py`, `ems/scenarios/bounds.py`, the calibration bundle and the data manifests;
4. records the new SHA-256s in an `evaluator_update` ledger entry. The chain continues from entry 10.

**Data stays out of git.** Only the manifests and the calibration bundle (fitted parameters plus empirical distributions, at most a few MB) are committed. The raw rows are about 1.5 million a year and live in a local cache rebuilt from the manifests.

## 5. Splits and holdout pools
| Use | Window | Notes |
|---|---|---|
| Calibration and dev | 2017-01-01 … 2019-12-31 | Fits, anchors and dev scenarios. Anchor days are excluded from the fit: a held-out sample of 2019 days, plus the January 2018 flu-peak days |
| Bounds only | 2005-01-01 … 2015-12-31 and 2017-01-01 … 2019-12-31 | Extremes for θ bounds, including Sandy (2012). 2016 is excluded because it is the normal holdout year |
| **Holdout: real surge A** | 2020-03-16 … 2020-04-15 | COVID wave 1, replayed exactly as it happened |
| **Holdout: real surge B** | 2021-12-15 … 2022-01-15 | Omicron, replayed exactly as it happened |
| **Holdout: normal** | 2016 days, salted sample | A seed derived from a salt kept outside the repository, as in CAGES |
| **Holdout: stress** | generated once | The red loop run against b1 before the first blue iteration; hashes in the ledger |

**Amendment (2026-11-01, Dylan):** the reviewer saw surge A summary statistics during design (§3), before the seal existed. Omicron (surge B) is therefore the **primary** real-surge confirmatory pool, and COVID wave 1 (surge A) is secondary, with this exposure disclosed in every pre-registration and in the paper. Omicron and the 2016 normal pool were never viewed.


**Sealing.** The data loader refuses holdout windows unless called by `eval_holdout`. `ar_check` flags any diff that adds a holdout date string. `AGENTS.md` forbids reading holdout windows outside the confirm step. The data is public, so this is a protocol fence, not encryption.

## 6. Calibration
- **Calls:** each call is replayed with its exact timestamp, zip code, initial call type and initial severity. Policies observe initial severity, and the metric uses it too, as in ARP, which measures by the category assigned at triage.
- **Space:** about 180 zip-code centroids from Census ZCTA, with the dispatch area as a fallback for missing zips.
- **Travel:**
  - an OpenStreetMap routing matrix between zip centroids (OSRM, car profile), times a fitted hour-of-day factor and lognormal noise;
  - unit origins are unobserved, so the factor is fitted by simulation to match observed `incident_travel_tm_seconds_qy` per borough and hour on normal days.
- **Service:** all empirical distributions, bootstrap-resampled within (call-type group, tier):
  - call processing: non-held dispatch delay;
  - on-scene: on scene → to hospital;
  - transport probability: share reaching a hospital, by call type;
  - transport time: to hospital → hospital arrival;
  - non-transport close: on scene → close.
- **Offload (hospital arrival → close):** an empirical base by borough and hour, times a fitted load term in the number of transports into that borough in the previous 2 hours. The 2017–2019 flu seasons provide the variation. Surges inflate offload on their own, and holdout surge A tests whether that generalizes.
- **Fleet:**
  - units busy at time *t* = incidents between assignment and close;
  - at the onset of held calls every unit is busy, so busy-unit concurrency at held onsets estimates the fleet in service per borough, hour and tour;
  - the fit report states the estimate's spread.
- **Not modelled:** hospital destination choice (no hospital IDs). Transport time is borough-level.

## 7. Anchors (frozen tests, pre-registered tolerances)
With b0 on 2019 days set aside from the fit, simulated normal days must reproduce:

| Anchor | Tolerance |
|---|---|
| Response time per tier: median / p90 | ±10% / ±15% |
| Held-call share | ±3 points |
| Daily transports | ±5% |
| Offload median | ±10% |
| **Surge direction:** January 2018 flu-peak days vs the trailing-28-day baseline | held-share increase reproduced within ±5 points |

The simulator's own invariants are also tested:
- a clone reproduces its run exactly;
- common-random-number replays differ only through the action changed;
- no unit is in two places;
- budgets are enforced.

## 8. Policy interface and levers
```python
class Policy:
    def reset(self, day: DayContext) -> None              # fleet per borough, unit-hour budget, date features
    def act(self, obs: Observation) -> list[Action]       # each event: call, unit freed, hourly tick
```

**Observation:** only what a real dispatcher has:
- the clock;
- pending calls: zip code, initial tier and call type, wait so far;
- unit status (idle, en route, on scene, transporting, at hospital, relocating) and location;
- elapsed time for units at a hospital, but not their completion time;
- recent rates by borough and tier;
- the remaining budget.

**Hidden:** future calls, final severity, transport need, offload completion.

**Actions:**
- `Assign(call, unit)` (holding a call is allowed);
- `Relocate(unit, zip)`;
- `Activate(borough, n)`: extra units after lag *λ* for a 12-hour tour, charged to the daily unit-hour budget *B*;
- `Divert(call)`: tier 3 only. A diverted call is resolved by secondary triage after *τ* minutes, or with probability *q* calls back as tier 2 after delay *D*.

**Parameters still to source:** *λ*, *B*, *τ*, *q*, *D* and the unit-unavailability range need literature sources (secondary-triage and mutual-aid evaluations) during M3. They are frozen in the bundle and covered by the sensitivity check (§11).

**Rules for policies:**
- invalid actions are ignored and counted;
- policies are deterministic given the seed;
- decision-time budget: p99 ≤ 50 ms per `act` call on the dylan-pc hardware.

**Baselines in M3:**
- **b0, practice:** tier priority, then first-in-first-out; the closest idle unit by travel time; return to the home zip; no surge levers.
- **b1, classical:** b0, plus hourly MEXCLP relocation (Daskin 1983), plus threshold surge rules (activate when the held share passes *x*; divert tier 3 when the queue passes *y*). *x* and *y* are tuned on dev, then frozen.
- **Antagonist:** b1 with true future demand and true offload completion. A reference only, never a candidate.

**Added in M4:** ADP redeployment (Maxwell, Restrepo, Henderson, Topaloglu 2010) and genetic-programming dispatch (MacLachlan, Mei, Zhang, Zhang, Signal; GECCO 2023), reimplemented as required baselines.

## 9. Scenarios and red-loop bounds
**A scenario** is a dev trace day, plus a perturbation θ, plus a seed. The components of θ, with bounds in the frozen `bounds.py`:
- **Demand multiplier:** calls duplicated or thinned within (borough, hour), preserving the spatial and temporal pattern. Range [0.9, *m*ₘₐₓ], where *m*ₘₐₓ is the largest daily-volume ratio to the trailing-28-day mean in the bounds window (§5).
- **Acuity shift:** tier shares scaled within their daily range in the bounds window.
- **Extra offload inflation:** [1, *o*ₘₐₓ], where *o*ₘₐₓ is the worst pre-2020 borough-day ratio.
- **Unit unavailability:** [0, *u*ₘₐₓ], from literature.
- **Spatial concentration:** extra calls focused in at most *k* zips, capped by the largest pre-2020 single-zip daily excess.

**How the red loop uses it:**
- it edits only the sampler (which days, which θ);
- θ outside the bounds raises an error and is never clipped;
- its objective is regret = L(policy) − L(antagonist), averaged over seeds.

## 10. Metric and evaluator
**Per scenario-day:**

L = Σ over calls of w_tier × max(0, R − T_tier), in minutes.

| Tier | FDNY segments | Target T (ARP 90th centile) | Weight w ∝ 1/T |
|---|---|---|---|
| 1 | 1 (cardiac arrest, choking) | 15 min (ARP Category 1) | 8 |
| 2 | 2–3 (life-threatening) | 40 min (ARP Category 2) | 3 |
| 3 | 4–8 (non-life-threatening) | 120 min (ARP Category 3) | 1 |

- R runs from call creation to the first unit on scene.
- **Unserved calls** at day end count with R = end − creation. They are never dropped.
- **Diverted calls** count R = τ, or, if they call back, the time from the original call to the eventual unit on scene.
- **Activations past *B*** are rejected by the simulator.
- **Claims:** L is paired by scenario-day, tested with Wilcoxon plus a bootstrap 95% CI, with Holm correction across the comparisons and metrics of each pre-registration. A claim stands only if its sign and significance also hold under weights 1:1:1 and 20:5:1.
- **Secondary measures:** tier-1 p90 response, held share, unit-hours used, divert share and callbacks.

## 11. Counterfactual per-decision reports (`ems/cf.py`)
- **When:** at sampled decision points (assignments while the queue is non-empty, and every `Activate` and `Divert`; at most *N* per day).
- **How:** the simulator is cloned. Each alternative is evaluated under the same random draws for 60 minutes:
  - the next 3 nearest idle units;
  - holding the call;
  - diverting it (tier 3);
  - activating 0 or 1 extra unit.
- **Output:** a list of the highest-regret decisions (time, state summary, chosen action, best alternative, ΔL), written beside each benchmark run for the blue agent to read.
- **The same machinery also runs sensitivity sweeps** of *λ*, *B*, *τ*, *q*, *D* and *u* for the frozen-parameter check.

## 12. Compute gate (pre-registered)
- `experiments/ar/ems_blue_bench.py` must score 200 dev scenario-days in ≤ 10 minutes on 24 cores (excluding any model training), so a blue iteration fits within 30 minutes.
- If it fails, M3 optimizes (vectorized travel lookup, a compiled event loop) or coarsens (dispatch-area nodes) **before** freezing.

## 13. Build sequence (the plan will expand each step with tests)
1. **Maintainer change:** `maintainer/apply-m3.sh` plus an overlay test (`loopkit`, the CAGES move, the guard per judge, the ledger root marker). Dylan runs it, and CI stays green.
2. **EMS data:** the ingest, the manifests for the 2017–2019 and bounds windows, and the hashed holdout-window manifests (no rows read).
3. **Calibration:** the fits, the bundle and the fit report.
4. **Simulator:** the core, clone and CRN, with invariant tests.
5. **Policies:** the API, b0, b1 and the antagonist.
6. **Anchors:** the tests of §7 must pass.
7. **Evaluator:** the metric, the statistics via `loopkit`, the holdout gate and the sealing checks (loader refusal, an `ar_check` date scan).
8. **Scenarios:** the sampler, `bounds.py` (with each bound's derivation in the fit report) and the parameter sources for *λ*, *B*, *τ*, *q*, *D* and *u*.
9. **Counterfactual reports.**
10. **The benchmark and the compute gate.**
11. **Freeze:** an `evaluator_update` ledger entry with the judge's SHA-256s, plus a `dataset_release` for the manifests and the calibration bundle. Then the review gate (Dylan).

## 14. Out of scope for M3
- Running any red or blue loop.
- Any holdout evaluation.
- The ADP and genetic-programming baselines (M4).
- Hospital destination choice.
- Other cities.

## 15. Risks and open items
- **Fleet inference:** the estimate can be off where held onsets are rare. The fit report gives its spread, and the anchors catch gross errors.
- **Travel fit:** with unit origins unobserved, the travel factor may not be identifiable. Fallback: fit per dispatch area.
- **Offload load term:** it may overfit flu seasons. Holdout surge A is the honest test, and a failure there is a reportable result, not a fix-up.
- **Lever parameters:** *λ*, *B*, *τ*, *q*, *D* and *u* have no NYC data and come from the literature. Every claim carries the sensitivity check.
- **Leakage:** the holdout data is public. The fence is protocol plus `ar_check`, and any breach voids the claim.
- **Compute** may fail the gate. Mitigations are in §12.
- **Licensing:** NYC Open Data terms of use apply to the cached rows, and only derived parameters are committed (to confirm in step 2).

## Sources
- NYC Open Data, EMS Incident Dispatch Data (`76xm-jjuj`). https://data.cityofnewyork.us/resource/76xm-jjuj.json. Queried 2026-10-29 for the counts and day statistics in §3.
- NHS England Ambulance Response Programme standards, as published by South East Coast Ambulance Service: Category 1 mean 7 min, 90th centile 15; Category 2 mean 18, 90th centile 40; Category 3 90th centile 120; Category 4 90th centile 180. https://www.secamb.nhs.uk/what-we-do/ambulance-response-programme (read 2026-10-29)
- FDNY Citywide Statistics: segment 1 = cardiac arrest and choking; segments 2–3 = life-threatening medical emergencies; segments 4–8 = non-life-threatening. https://www.nyc.gov/assets/fdny/downloads/pdf/about/citywide-stat-2018-04.pdf (PDF; metadata only)
- Daskin M.S., A maximum expected covering location model: formulation, properties and heuristic solution, Transportation Science 17(1), 1983 (metadata only).
- Maxwell M.S., Restrepo M., Henderson S.G., Topaloglu H., Approximate dynamic programming for ambulance redeployment, INFORMS Journal on Computing 22(2):266–281, 2010 (metadata only).
- MacLachlan J., Mei Y., Zhang F., Zhang M., Signal J., Learning Emergency Medical Dispatch Policies Via Genetic Programming, GECCO 2023 (OpenAlex record read 2026-10-29).
- Dennis M. et al., Emergent Complexity and Zero-shot Transfer via Unsupervised Environment Design (PAIRED), NeurIPS 2020 (metadata only).
