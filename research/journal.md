# Research journal

## 2026-10-26: seed
- Built the simulator, crowd model, CAGES pipeline, decision models and harness (see git log).
- Validated:
  - round-trip time vs Barney's formula, within 2%;
  - social-force diagram vs Weidmann, RMSE 0.09 m/s over 0.5–4 p/m²;
  - counterfactual labels vs brute-force replay, exact match.
- JuPedSim was not installable in the build container; it remains an optional backend.
- Timestral could not be installed in the build container (external git install not permitted there). Its adapter follows the documented API and is unexercised.
- Next: v0-mini generation, the dev baseline comparison, a tiny training run, then pre-registering H1–H3 in the ledger.

## 2026-10-27: v0-mini, tiny model, dev comparison
- Generated CAGES v0-mini: 1,532 train and 382 dev labelled decisions, in about 24 min on 4 CPUs. Ledger entry 3. Pre-registered H1–H3 (entries 0–2).
- Trained the tiny scratch model (0.87M parameters, 40 epochs, 3.4 min). Offline it is comparable to ESA, not better.
- Closed-loop dev (n=20; see `research/results.md`):
  - schedule pre-positioning: −29% P95 vs ESA;
  - mixture at threshold 0: −13.5% P95 beyond pre-positioning, with 20/20 instances improved;
  - H1 dev estimate: 98.4% understatement.
- Caveats: the schedule forecaster is optimistic (it knows the true release profile); dev overlap; n=20.
- Next:
  1. Replace the schedule prior with a learned forecaster (Timestral) and re-run on dev.
  2. Scale CAGES (cloud step 1).
  3. Tune the confidence threshold on dev.
  4. Run the decapitated Glimmer, Laya and scratch-20M runs on GPU.
  5. Then the H1/H2 holdout runs, executed by the salt holder.

## 2026-10-27: handoff to the GPU machine
- Training is now CUDA-ready:
  - automatic device selection;
  - QLoRA (nf4) for 16 GB cards;
  - head-plus-adapter checkpoints, so a trunk can be reloaded in bf16 or 4-bit (round-trip tested).
- Forecast evaluation (2 dev instances, smoke test only):
  - schedule prior: weighted error 8.6% at 600 s, because it knows the true profile;
  - hall-call history alone: about 99%, because calls hide the crowd.
  - So a learned forecaster needs the event schedule as a known-future covariate.
- Evaluator v1.1 is prepared as a reviewed patch (`maintainer/`). Applying it is the maintainer's call; an agent cannot unfreeze the evaluator.
- Next: `docs/runbook-gpu.md` §0–7 on the RTX 5060 Ti machine; the loop is driven from Muse Code per `docs/runbook-loop.md`.

## 2026-10-27: gpu-phase — forecaster eval, cages-v0, Glimmer trunks
- Forecaster eval (n=15 dev, Timestral on CUDA; `experiments/results/forecast_eval.json`):
  - schedule prior: 11.4% WAPE at 600 s (knows the true release profile);
  - recent_only (hall calls alone): ~100% (hidden-queue effect, as expected);
  - timestral blend 0.5: 54.1%; timestral_only: 106.4%.
  - Timestral alone is clearly worse than the schedule prior, so the prior stands; any pre-positioning claim assumes a published schedule.
  - Fixed a CUDA bug in `cages/forecast/timestral_adapter.py`: forecast quantiles are now moved to host memory before numpy conversion.
- Scaled the dataset (`datasets/cages-v0`, committed, 5.4 MB): 600 train instances (15,189 states, ~52 min on 20 workers) and 100 dev (2,546 states); card stats in `datasets/cages-v0/stats.json` (ESA matches best action on ~30% of train states).
- Downloaded Muse-Glimmer-30B (~56 GB cache) and cut two bf16 trunks: L8 (3.87B params, 97 tensors kept) and L12 (5.81B params, 145 kept). Trunks live in `runs/` (git-ignored); decapitation records copied to `experiments/results/`.
- No holdout or confirmatory runs were executed in this session.

## 2026-10-27: forecaster verdict and prior robustness (this container)
- Reviewed the GPU-machine report:
  - CAGES v0: 15,189 / 2,546 labelled decisions;
  - Glimmer trunks: L8 3.87B, L12 5.81B parameters;
  - zero-shot Timestral fails on hall-call series (WAPE ≥ 1.0).
- Closed loop with a misspecified prior (flat profile, attendance ±30–43%): P95 −28.4 to −28.5% vs ESA, against −28.7% for the exact prior. The pre-positioning gain doesn't depend on the optimistic prior.
- Fixed `scripts/install_git_hooks.sh` to use the venv.
- Next:
  1. Apply evaluator v1.1 (maintainer).
  2. H3 training runs on the GPU (L8 bf16 LoRA, L12 QLoRA, Laya, scratch-20M on CAGES v0).
  3. Check that the mixture holds up under the misspecified prior.
  4. Dev selection and the edge benchmark.

## 2026-10-28: pivot to subway and bus evacuation
- **Decision (Dylan):** a hard pivot from elevators to emergency evacuation by train and bus, treated as "trains instead of elevators". The elevator code is deleted, CAGES keeps its name with E = Evacuation, and calibration is to the NYC subway and buses.
  - Task 001 (elevator GPU work) was withdrawn before it started.
  - Ledger entry 5 withdraws H1–H3; no holdout was ever run.
  - The last elevator commit is `5b9ee7e`. Pushing a tag from the build container was refused by the git proxy, so that commit is recorded here instead.
- **Built:**
  - a line simulator for the 7 line: 22 stations from MTA GTFS, two tracks, no overtaking, one train per signal block, terminal turnbacks, load-dependent dwell and door holds;
  - Corona Yard spare trains and shuttle buses;
  - platform-crowding alerts answered by one of eight slots;
  - five worst-case failure modes;
  - true vs operator-logged waits;
  - calibration from MTA GTFS (feed `20261028-fall-2026-pick`) and 2024 hourly ridership, with Mets–Willets Point's busiest hour at 13,165 entries.
  - The baselines, features, labeller, decision-model inputs, gym env, MCP tools and anchors were rewritten. The frozen evaluator and instances at v2.0 wait in `maintainer/v2/` for the maintainer.
- **Validated:** all tests pass in the v2 overlay (`research/results.md`, "Validation").
- **Results (dev, exploratory; `research/results.md`):**
  - CAGES v0-mini: 419 / 153 labelled alerts (ledger entry 6).
  - Staging yard trains and buses on the declaration cuts P95 by 18% vs current reactive practice.
  - A tiny decision model adds −1.4% [−2.3, −0.5] beyond staging.
  - The rolling-horizon planner is worse than the simple express rule.
  - Logs understate true waits by 72.5%.
- **Next:**
  1. Dylan applies `maintainer/apply-v2.sh` and reviews the E1–E3 drafts (`research/prereg/drafts/`).
  2. Label-horizon test (done, `experiments/results/label-horizon-v0mini.json`): with 2,700 s labels "no action" is best in 29% of alerts instead of 51%, but the tiny model gains nothing over staging (+0.4% [−2.0, +3.8] vs −1.4% at 900 s). Compare both horizons on CAGES v0.
  3. Scale to CAGES v0 and run the E3 backbones on the GPU (runbook §2–5, through the mailbox).

## 2026-10-29: CAGES v0, horizon choice, E3 backbones (task 002, done)
- **Laya reproducible:** `scripts/extract_laya_encoder.py` rebuilds `runs/laya-encoder` byte-identically from `convaiinnovations/laya` at `7b928d82…` (170 tensors, 394.8M params).
- **Protocol fixed first:** ledger seq 8 records the horizon rule, the six E3 arms and the dev-selection rule before any result existed.
- **CAGES v0** (ledger seqs 9–10): 3,000/300 instances → 23,554/2,360 labelled alerts at each of h900 and h2700, from byte-identical specs. Cards: no-action-best 52%→23%, median action gap 5%→10% at the longer horizon.
- **Horizon:** the 3.4M scratch probes give mixture@0.0 dev P95 2142.69 (h900) vs 2136.97 (h2700); the rule picks h2700 mechanically (`experiments/results/label-horizon-v0.md`). Margin 5.72 s with overlapping CIs.
- **E3 arms** (all 6 epochs, batch 16, lr 2e-4, no OOM): L8-bf16 52 min, L12-nf4 104 min, Laya 17 min, scratch ×3 seeds ~3 min each. Offline dev top-1: s1 0.505, L8 0.502, s2 0.479, Laya 0.455, s0 0.449, L12 0.420 (`experiments/results/evac-*-metrics.json`).
- **Dev selection** (`experiments/results/dev-selection.md`, 40 instances): best P95 per arm — Laya @0.0 2118.72 (−3.45% vs staging), scratch s0 @0.2 2137.86, L8 @0.2 2145.73, L12 @0.0 2148.03. Laya and scratch beat both Glimmer trunks in closed loop despite L8's better offline top-1.
- **Edge:** all pass p99 ≤ 50 ms at trained precision — L12-nf4 48.90, L8-bf16 44.78, Laya 29.45, scratch ~3 ms (`experiments/results/edge-*.json`). E2 checkpoint by the rule: laya-r16 @0.0.
- **Needs approval:** the four arm picks and the E2 checkpoint; then `model_choice`, E1–E3 registration, and Dylan's confirmatory runs. Full record: `ops/reports/002-transit-v0-and-backbones.md`.

## 2026-10-29: problem survey (M1)
- **What was tried:** 8 emergency-logistics candidates scored against the 8-criterion scorecard, with 37 sources accepted. A method novelty check, and adversarial verification of the top 3.
- **What happened:**
  - Verification rescored 4 criteria and changed the ranking: top 3 = EMS surge dispatch (36), wildfire evacuation (35), hurricane evacuation (34).
  - Recommendation: EMS surge dispatch, with the loop metric "acuity-weighted minutes beyond the response-time target".
  - Novelty is partial: RAISE (2026) pairs LLM heuristic design with an adversary, and genetic programming has evolved EMS dispatch policies (GECCO 2023).
  - Nothing was dropped by the hard filters.
  - Brief: `research/problem-selection/emergency-logistics-survey-brief.md`.
- **Next:** Dylan picks the problem (M1 gate); then M3 planning.

## 2026-10-29: M2 dry run (task 003, blue loop on CAGES)
- **What was tried:** the ported autoresearch skill, run by Muse Code headless (`muse exec --trust-workspace`), for 3 iterations over `experiments/ar/cages_blue_config.json`. Metric: p95. This was a wiring test, not a finding.
- **What happened:**
  - 4 log entries: a baseline of 2424.61; #1 threshold 0.2→0.0 reverted (2434.69); #2 lr 2e-4→3e-4 kept (2416.78); #3 epochs 6→8 reverted (2425.30).
  - `ar_check`: 4 entries, 0 problems. Scope was clean, pytest and the name guard pass on `ar/blue/cages-dry-run`, and the branch was pushed.
  - 179–230 s per benchmark run, against a 30-minute ceiling.
  - The skill loaded natively through `read_skill`.
  - Friction found and fixed: the baseline commit format, the meaning of `commit` and `seconds`, and the `.venv` symlink showing as untracked (now ignored).
- **Next:** M2 machinery verified. M3 waits on the M1 pick.

## 2026-11-01: EMS calibration bundle (M3b)
- **What was tried:** ingested 2017–2019 NYC EMS dispatch data (manifests `calib-2017..2019`; holdout windows recorded as counts only) and fitted service, offload, fleet and travel targets on fit days (anchor days excluded).
- **What happened:** 4,238,644 fit rows on 1,027 fit days (68 anchor days excluded; 48 dropped bad severity). Fleet median-of-medians: Brooklyn 61.5, Bronx 52.0, Manhattan 49.0, Queens 41.5, Staten Island 9.0. Offload betas: Bronx 0.0008, Brooklyn 0.0003, Manhattan 0.0009, Queens 0.0012, Staten Island 0.0033, UNKNOWN 0.0000 (all ≥ 0). Anchor tier-1 p50/p90 4.9/8.0 min; flu held-share increase 0.121. Bundle files and SHA-256s in `judges/ems/calibration/bundle_manifest.json`.
- **Next:** M3c plan (simulator, policies, anchors, travel-scale fit).

## 2026-11-01: Offload ratio24 refit blocked on the Jan 2018 check (task 008)
- **What was tried:** refit hospital offload with a 24 h surge ratio (`fit_offload_ratio`) and checked it against the dev-visible Jan 2018 flu anchor days (`jan2018_check`, tol 0.015), then re-ran the full calibration bundle (report: `ops/reports/008-offload-refit.md`).
- **What happened:** the check failed in all 5 boroughs. Observed flu-day offload medians rose 2.4–4.8% (BRONX 1.0479, BROOKLYN 1.0322, MANHATTAN 1.0274, QUEENS 1.0243, RICHMOND 1.0249), but the fitted betas are ≈0 to slightly negative (−0.022 to +0.011), so predictions sit at ≈1.000. Day-to-day 24 h load variation does not predict offload on the 1,027 fit days. Numbers in `judges/ems/calibration/offload_check.json` and `judges/ems/calibration/fit_report.md`; bundle re-verified (BUNDLE_OK). Per the task stop rule the task is blocked with the model unchanged.
- **Next:** reviewer decides the next offload-model direction in a new task.

## 2026-11-01: Base-only offload; surge offload becomes a bounded scenario factor (task 009)
- **What was tried:** removed the endogenous load term from hospital offload (`offload.json` is now `{"model": "base"}` with 101-point base tables) and measured the surge-offload scenario factor θ "extra offload inflation" from real pre-2020 days (`offload_inflation_range`: day-median over trailing 28-day median, ≥20 transport days in the window), then re-ran the full calibration bundle (report: `ops/reports/009-offload-scenario.md`).
- **What happened:** base tables identical to task 008; the task-008 null result is kept as committed evidence in `offload_load_null.json`. Inflation over 1,075 days per borough: p50 ≈ 1.00 everywhere, max 1.0495–1.1511; o_max (citywide max, bound for M3d) = 1.1511 (Staten Island). UNKNOWN has only 3 transported days and yields no window. Bundle re-verified (BUNDLE_OK); all other bundle bytes identical.
- **Next:** M3d consumes o_max as the θ bound; reviewer writes the next task.

## 2026-11-01: EMS simulator, b0 fit and anchor check (M3c, task 010)
- **What was tried:** built the event-driven EMS simulator (`ems/sim/`), the policy API and the practice baseline b0 (`ems/policy/`), replay day tables for all 1,095 calibration days, and fitted the fleet multiplier, travel scales and per-tier travel factors on 24 sampled fit days (plan: `docs/superpowers/plans/2026-11-01-m3c-ems-simulator.md` Tasks 1–4; report: `ops/reports/010-m3c-ems-simulator.md`). This is machinery, not a finding.
- **What happened:** `fleet_k` = 1.1980; tier factors 0.546 / 0.712 / 0.957; travel sigma at the 0.05 floor in all boroughs. The single anchor check on 68 held-out anchor days gives 7/10 (exit 1, as frozen): tier-1/2 p90 too long in simulation (11.1 vs 8.0 min; 14.4 vs 11.0 min) and tier-3 p50 too short (7.7 vs 9.1 min); held share, transports, offload median and the Jan-2018 flu increase all pass. Limits recorded in `judges/ems/calibration/anchor_report.md`. Full suite: 110 passed, 1 skipped; ruff and name guard clean.
- **Next:** M3d (levers, scenarios, frozen evaluator) consumes the simulator and the anchor report.

## 2026-11-01: EMS evaluator, scenarios, b1, counterfactuals and benchmark (M3d, task 011)
- **What was tried:** built the frozen lever parameters and scenario bounds/sampler, the b1 classical baseline with its foresight oracle, the frozen evaluator with paired claims and holdout gate, per-decision counterfactual reports with a sensitivity sweep, and the blue-loop benchmark (plan: `docs/superpowers/plans/2026-11-01-m3d-ems-evaluator.md` Tasks 1–4; report: `ops/reports/011-m3d-ems-evaluator.md`). Dev days only; `eval_holdout` never called. Nothing here is a finding.
- **What happened:** compute gate passes: cold 91.22 s, warm 30.66 s (gate 600 s), METRIC ratio_b1=1.0000, candidate primary 11247.14. On 200 dev days: b1 11247.1, oracle 13278.5, ref 10759.4 (primary); oracle beats b1 on 71 of 200. Counterfactual on 2018-02-12: factual_primary 1603.57, 22 decision points, 20 sampled. Sensitivity (b1/b0 primary, n=48): central 0.0413, all CI upper ends below 0.1; callback delay most sensitive (0.0091–0.0824). Known limits in `judges/ems/calibration/m3d_report.md`. Full suite: 122 passed, 1 skipped; ruff and name guard clean.
- **Next:** freeze is a separate maintainer step after Dylan's review (no `judges/ems/FROZEN`, no ledger entries written).

## 2026-11-02 — M6 sealed run (EMS1–EMS5)
- Ran `judges/ems/scripts/confirm.py run` once (task 021 loader). Sealed windows matched their manifests: covid-a 161,820 rows, normal-2016 1,441,211, omicron-b 141,950 (`research/m6/holdout/sealed_windows.json`).
- Ledger seq 22–26: `holdout_eval` for EMS1–EMS5; every claim is null. EMS5 decided by its own rule (`research/m6/holdout/EMS5_decision.json`): null for NO_CF and BLUE_ONLY.
- Pattern: the hold-rule policies cut lateness 27–33% on the generated stress pool, but were 3% worse on Omicron and 6–8% worse on normal 2016 days. COVID wave 1 was inconclusive. The dev gain did not transfer to real surge days in the simulator.
- Next: write up; investigate why the stress pool and dev days differ from real surge days (concentration, unavailability, urgent share).

## 2026-11-03 — Low Key preflight completed (task 023, branch `low-key`)
- **What was tried:** applied the PRD lineup rules to the task-022 retention fits (four picks per category, at most 2 per make, heavy-duty pickups excluded, 15% trade-in discount), then ran the remaining preflight checks P10 (Muse Spark tool use), P15 (EIA gas series and ZIP map) and P16 (Timestral-28M backtest). Reports: `ops/reports/023-lowkey-rules-and-remaining-checks.md`; numbers: `lowkey/docs/preflight-results.md`.
- **What happened:** Sedan Accord/Civic/Mazda3/Elantra (Civic is also the commodity pick), SUV CR-V/Corolla Cross/CX-50/4Runner (commodity Venue), Pickup Tacoma/Ram 1500/Colorado/Silverado 1500 (commodity Maverick); six heavy-duty models excluded. P10 passed after one system-prompt fix (tools 10/10, numbers 10/10; latency 18–34 s per prompt). P15 passed (29 EIA series, shortest history 23.4 years; test ZIPs map to Chicago, PADD 1C, PADD 4). P16 passed pooled (77.0% coverage vs 70% bar; median MAE $0.396 vs $0.418 flat) but the median lost to flat across the East Coast. Timestral weights are Modified MIT with a $20M monthly-revenue cap.
- **Next:** Dylan to reconcile the PRD's three-card text with the four-pick rule, decide the P9 latency question, and close or run task 024 part 3 (P8 spot-check of the new #3/#4 picks).

## 2026-11-03 — Low Key four-pick confirmation (task 024, branch `low-key`)
- **What was tried:** verified that the four-pick lineup rule (at most 2 per make, commodity `badge`/`extra`, shortfall handling) and the three four-pick lineups from task 023 satisfy the amended rule, then spot-checked local supply for the six new #3/#4 picks at ZIP 60614 (50 miles). Report: `ops/reports/024-lowkey-four-picks.md`; numbers: `lowkey/docs/preflight-results.md`.
- **What happened:** no code or lineup change was needed — fixture tests 9 passed and recomputing from the cached fits reproduced the lineups exactly (3 makes per category, none short of 4). All six #3/#4 picks have stock nearby: Mazda3 Sedan 127 ($24,470), Elantra 309 ($19,799), CX-50 391 ($30,159), 4Runner 30 ($44,091), Colorado 332 ($33,746), Silverado 1500 912 ($37,812). Listings spend $0.010 of the $0.25 cap.
- **Next:** Dylan to reconcile the PRD's three-card text with the four-pick rule before the app (task 025) hard-codes a card count.

## 2026-11-03 — Low Key chat app scaffold (task 025, branch `low-key`)
- **What was tried:** scaffolded the minimal deployable Next.js chat app in `lowkey/app` (Vercel Root Directory `lowkey/app`, Node 22) talking to Muse Spark via the AI SDK OpenAI-compatible provider (`https://api.meta.ai/v1`, `muse-spark-1.3`), with stub tools `rank_category`, `ownership_math`, `local_units`, mobile-first card UI, and the real deterministic ownership maths with unit tests. Report: `ops/reports/025-lowkey-app-scaffold.md`.
- **What happened:** `npm ci && npm run build` passes; app tests 18 passed; `pytest -q` 154 passed, 1 skipped; name/secret guards clean. The intermediate scaffold push already serves at https://low-key-murex.vercel.app (HTTP 200). Two real `60614, SUV` dev turns (key from `~/.config/low-key/env` only): the first exposed a model-name bug (`Honda CR-V` vs fixture `CR-V` → zero units), fixed with canonical model resolution plus regression tests; the second returned all 5 cards' tool data (rank + payment + local stock) in 40.4 s using 5,232 tokens. Latency still breaks the PRD's 15-second first-cards bar, and Spark returned no closing summary sentence in either turn — the cards carry the numbers.
- **Next:** Dylan to confirm the 8% APR default and the four-card reading of the PRD, then the follow-up task wires real listing data (provider MCP) in place of the fixtures.

## 2026-11-03 — Low Key chart, Federal Reserve rate, code summary and fast cards (task 026, branch `low-key`)
- **What was tried:** gave `ownership_math` the 61-point worth-vs-owe curve, `evenMonth` and the `{getBack, costPerMonth}` table; built the mockup full chart (native slider, dark two-sentence box, three-column table) plus mini charts on every card; made the Federal Reserve 60-month average (FRED `RIFLPBCIANM60NM`, 1-day cache) the default APR with an 8.0% "assumed" fallback; moved card/closing sentences to code templates; probed lower reasoning effort and added a first-turn ZIP+category fast path. Report: `ops/reports/026-lowkey-chart-rate-speed.md`.
- **What happened:** live FRED value 7.54% (Aug 2026). `reasoning_effort` is supported (`minimal` cut a stub-tool turn from 14.31 s to 5.46 s); the fast path was still needed — deployed "60614, SUV" went from first card 16–23 s / full 49–60 s to 0.2–0.5 s. App tests 46 passed; `pytest` 154 passed, 1 skipped; guards clean; live commit 59f6b31. Sample note: `getBack` at 36 is $10,099 vs ≈ $10,118 because 0.629 rounds 0.85 × 0.741.
- **Next:** Dylan to decide whether later-turn category switches also take the fast path, and whether card sentences quote after-discount (63%) or retail (74%) retention; real listing data remains a later task.

## 2026-11-03 — Low Key real data (task 027, branch `low-key`)
- **What was tried:** built the weekly depreciation table on dylan-pc (`lowkey/pipeline/build_table.py` reusing the preflight fits, EPA MPG and EIA/Timestral forecasts) into private Blob storage, pointed `rank_category` at it, switched `local_units` to the live listings search (REST, 50→150 widening, 6-hour cache), priced payments from the cheapest local unit, added per-card fuel, removed all sample-data paths, and reframed the opening around “Get a car without regret.” Report: `ops/reports/027-lowkey-real-data.md`.
- **What happened:** table holds the four-pick lineups from 82,611 sold vehicles (provider as of 2026-11-03; EIA week of Oct 26, 2026) and was uploaded as private `lowkey/table.json` at $0.00 provider cost from same-day caches. Deployed first cards: 60614 SUV 0.83 s, 30097 pickup 0.23 s (both cache-warm; fresh 1.70 s / 1.11 s), rural 59001 sedan 4.89 s with widening to 150 miles. The first rural run exposed Tier 1 429s on parallel searches; fixed with 429 backoff/retry and serial fast-path searches. Total provider spend $0.054 of the $2.00 cap (27 listing searches); Spark $0. App tests 64 passed; `pytest` 154 passed, 1 skipped; guards clean. Live app commit `7143e09`.
- **Next:** reviewer to schedule the weekly table re-run from `lowkey/docs/deploy.md`; Dylan to answer the report's four questions (retention quote, 2027 local units, 150.2-mile display, P1 attribution).

## 2026-11-03 — Low Key trim, lifespan and salient card costs (task 029, branch `low-key`)
- **What was tried:** reserved a Toyota and a Honda slot in the Sedan/SUV lineups; recommended the one-step-up trim per model from specs starting MSRPs with a task-022 retention guard and a per-ZIP no-stock fallback; audited three lifespan sources (P18) and adopted the iSeeCars expected-lifespan-years study; rebuilt each card around five salient numbers (monthly bills, cost to drive, dealer distance, lifespan, underwater) with the trim and lifespan in the code-written sentence. Report: `ops/reports/029-lowkey-trim-lifespan-costs.md`; audit: `research/claims.yaml` (`lowkey029-iseecars-*`).
- **What happened:** Sedan became Accord, Civic, Mazda3, Corolla (live-confirmed, Elantra gone); SUV unchanged. Trims came from specs for all 14 models; the guard sent CR-V (EX fit 0.688 vs model 0.741) and Colorado (LT 0.583 vs 0.664) back to base, and no deployed ZIP needed the no-stock fallback. Lifespans cover 10 of 12 ranked models (Corolla Cross and CX-50 unpublished, shown as nothing). Deployed turns 0.26 s (60614 SUV) and 0.30 s (30097 Pickup), cache-warm; the hand-worked CR-V card ($743 bills, $461 cost to drive, 14 years, 6 months underwater) recomputes exactly. Provider spend $0.50 of $1.50; Spark $0. App tests 81 passed; `pytest -q` 154 passed, 1 skipped; guards clean.
- **Next:** Dylan to answer the report's three questions (Venue two-tone step, guard price basis, brand-average fallback for unpublished lifespans); reviewer to fold the trim/lifespan build into the weekly table re-run.

## 2026-11-03 — Low Key honest numbers (task 031, branch `low-key`)
- **What was tried:** one after-discount resale basis everywhere (display converts retail fits by the table's factor; the guard still compares retail fits), model years on every listed unit with a leftover-year note, a "Not yet rated" lifespan row for unrated models, cosmetic-variant merging in the trim pipeline, and a 96 px card figure beside the title. Report: `ops/reports/031-lowkey-honest-numbers.md`.
- **What happened:** CR-V card now reads "the EX keeps 58% … below the model's 63%" with no retail percentage left on the page; Venue's step became the SEL (only trim that moved; one merge logged: 'SEL w/ 2-Tone Roof' -> 'SEL'); a live 2025 Venue unit drew the leftover note; Corolla Cross, CX-50 and Venue show "Not yet rated". Table rebuilt and re-uploaded at $0.00; deployed checks at 60614 (Sedan 4.36 s to cards) spent $0.010; Spark $0. App tests 102 passed; `pytest -q` 154 passed, 1 skipped; guards clean. Live commit `79dcb9c`.
- **Next:** Dylan to answer the report's two questions (merged SEL priced off the cheapest variant's MSRP; three-unit distance row).

## 2026-11-03 — Low Key search-area polish (task 032, branch `low-key`)
- **What was tried:** kept the header-guessed area labelled "(approximate)" until Change or a successful location lookup confirms it (confirmed flag persisted in `localStorage`; confirmed stored beats the header guess, unconfirmed yields to it), and made a bare or failed city lookup retry once after about 1 s on the client (`/api/geo`) and on the server's Census geographies call. Report: `ops/reports/032-lowkey-area-polish.md`.
- **What happened:** warm TIGERweb/Census probes for 30097 both return Duluth, GA, so report 030's cold bare ZIP was a transient empty Census response — the retry now covers that path. Deployed fresh-profile checks at 390 px: Marietta guess labelled, still labelled after a Sedan tap (stored `confirmed:false`), Change to 60614 shows "Searching near Chicago, IL 60614" with no label (stored `confirmed:true`), unchanged after reload. Spend $0.00 of each $0.10 cap; Spark $0. App tests 114 passed; `pytest -q` 154 passed, 1 skipped; guards clean. Live commit `ee90eb3`.
- **Next:** Dylan to answer the report's two questions (flagless pre-032 stored areas count as confirmed; quiet 1 s retry wait with no progress copy).
