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

## 2026-11-01: ems-full blue iters 1-6, red iter 1 kept (task 019)
- **What was tried:** baselines (blue 1.0000, red regret 500.25), then blue iters 1-4 (pre-Amendment): default MLP training on 200 early-morning-labelled days drifted to 2.87; imitate 1/10 closed it to 2.05/1.50; masked sharp labels alone did not (2.84). Red iter 1 kept max load + max urgency (regret 694.06); blue iter 5 rebaselined at 1.0000 on the harder pool (b1 primary 12264 -> 25111). Blue iter 6 (first Amendment-1 iter): 50-day gen with whole-day labels (0.1-23.5 h) + imitate 10 with masked sharp labels, trained on it06 only.
- **What happened:** iter 6 reverted at 1.0134 (train 26 s wall / 20.6 GPU s - the container-queue fix works; gen 577 s under sibling contention). The policy now assigns more aggressively than b1 (held 0.238 vs 0.289), cascading into more diverts (0.130 vs 0.119). Nothing kept yet; best is the b1 baseline. Arm spend $0.99 + it06 gen/train.
- **Next:** iters 7-8 with a stronger anchor (imitate 30) on growing Amendment-1 windows, then red iter 2 after blue iter 8.

## 2026-11-01: ems-full blue iters 7-10, red iter 2 kept, Amendment 2 live (task 019)
- **What was tried:** blue iter 7 (imitate 30 on it06+it07) closed the gap to 0.16%; iter 8 (gain-gated imitation: gate_gain 100, gate_k 25, imitate 30, window it06+it07+it08) beat b1. Red iter 2 (max offload 1.151 + concentration 104 calls / 3 zips on top of iter 1) attacked the kept candidate; blue iter 9 rebaselined it on the new pool. Iter 10 retrained the unchanged iter-8 recipe on it06+it07+it08+it10 under Amendment 2 (no hold labels).
- **What happened:** iter 8 KEPT at 0.9943 (first keep; pytest 141 + name guard clean). Red iter 2 KEPT (regret 694.06 -> 1257.56; 104/200 days with regret). Rebaseline: the iter-8 keep scores 1.0021 on the harder pool (pool 4a3f9e94 -> 3ec06df3; b1 primary 25111 -> 27674), so the 0.9943 did not survive. Iter 10 reverted at 1.0134. Amendment-2 strip verified active on the deployed app: masked labels 2854/6972 = 40.9% vs stable pre-A2 61.8%. Under A2 the same recipe scores worse; suspect gate_gain=100 (calibrated on pre-A2 gains incl. hold deltas) never opens on unit-only gains. Iter-9 cf reports (60 rows): divert alts show the only consistent gains (4/4 < -0.5); unit alts mostly tie. Arm spend $1.87.
- **Next:** local A2 gain survey on it10-pool days, then iter 11 recalibrates the gate from it (window reused: 4 A1 dirs, best unchanged, no red keep since gen); red iter 3 after blue iter 12.

## 2026-11-02: ems-full blue iters 11-15, red iter 3 kept (task 019)
- **What was tried:** gate sweep under Amendment 2 on the reused 4-dir window (gate_gain 100 -> 25 -> 10); red iter 3 (busiest-days attack, thetas already maxed) with blue rebaselines after each red keep; gate-25 retrains on growing windows (6-dir, 7-dir); wider scorer [128,128]. A local gain survey was started but killed (too slow locally; a train-side quantile diagnostic superseded it).
- **What happened:** iter 11 (gate 25) KEPT at 1.0015, first A2 keep; the quantile diagnostic showed unit-only gains p50/p75/p90/p99 = 35/99/203/482 (same ballpark as pre-A2, refuting the never-opens story). Iter 12 (gate 10) reverted at 1.0088: gate minimum near 25. Red iter 3 KEPT (regret 1257.56 -> 1520.87, busiest 200 dev days, maxed thetas); blue iter 13 rebaselined at 1.0020 (b1 primary 27674 -> 33860). Iter 14 (gate-25 retrain on 6-dir window with fresh it14) KEPT at 0.9989, beating b1 on the new pool. Iter 15 ([128,128]) reverted at 1.0007: better train loss (18.92 vs 19.17) but worse deployment, so capacity is not the bottleneck. Best: iter-14 weights, 0.9989. Arm spend $2.68.
- **Next:** tau 0.5 (sharper label targets) on the reused 7-dir window for iter 16, then red iter 4 (due after blue 16; candidate: regret-mining the top-200 days from a 1027-day bench, since thetas and busiest-days are exhausted).

## 2026-11-02: ems-full blue iters 16-24, red iters 4-5 (task 019)
- **What was tried:** recipe sweeps on the mined pool: tau 0.5, gain_min 2.0, hidden [128,128] (already covered: capacity), and a full imitate sweep (100/30/10/3/1) plus gate_k 10; fresh-data retrains as the window churned (it18-it23, window full at 8 dirs since iter 18). Red iter 4 mined the top-200 regret days vs the iter-14 keep; red iter 5 re-mined vs the iter-18 keep.
- **What happened:** iter 16 (tau 0.5) reverted at 1.0100. Red 4 KEPT (regret 1520.87 -> 4306.68, all 200 days); blue 17 rebaselined at 1.0727. Iter 18 (fresh it18 retrain) KEPT at 1.0344; iters 19 (gain_min 2.0, 1.0376) and 20 (imitate 100, 1.0378) reverted. Red 5 reverted at 4132.41 (pool unchanged): blue is catching up to mining. Imitate sweep kept twice: iter 21 (10, 1.0337), iter 22 (3, 1.0286); iter 23 (1, 1.0416, drifts) and 24 (gate_k 10, 1.0370) reverted. U-shaped imitate optimum near 3. Recipe tuning looks exhausted at (imitate 3, gate 25/25, tau 1.0). Best: iter-22 weights, 1.0286. Arm spend $4.05.
- **Next:** candidate-file frontier (hold context features, divert rules) or fresh-data retrains; red 6 after blue 24 (re-mining has stalled - try weekday-varied thetas or a new mining target once blue moves).

## 2026-11-02: ems-full blue iters 25-28, red iter 6 kept (task 019)
- **What was tried:** re-mined regret vs the iter-22 keep for red 6; blue rebaseline on the new pool; fresh-data retrains of the imitate-3 recipe (it26, it27); a gate-widening probe (gate_gain 25 -> 50) at imitate 3.
- **What happened:** red 6 KEPT (regret 4306.68 -> 4530.61; the imitate-3 policy is less robust overall, mean regret 1468 vs 1332). Blue 25 rebaselined at 1.0820. Iters 26 (1.0523) and 27 (1.0448) KEPT on fresh-data retrains. Iter 28 (gate 50) reverted at 1.0521: wider gate pulls toward worse history, consistent with the labels-over-history lesson. Best: iter-27 weights, 1.0448. Arm spend $4.80.
- **Next:** red 7 after blue 28 (re-mine vs the iter-27 keep); blue 29+ continue fresh-data retrains (rule (b) keeps firing on keeps).

## 2026-11-02: ems-full blue iters 29-32, red iter 7 kept (task 019)
- **What was tried:** re-mined regret vs the iter-27 keep for red 7; blue rebaseline; fresh-data retrains (it30, it31); fine-grained imitate probe (5) between the tested 3 and 10.
- **What happened:** red 7 KEPT (regret 4530.61 -> 4617.18). Blue 29 rebaselined at 1.0976 (largest gap yet, ~10%). Iter 30 (fresh it30 retrain) KEPT at 1.0451 - the post-mining retrain pattern holds a third time. Iter 31 (fresh it31 retrain) reverted at 1.0478: the streak breaks, recipe converged near 1.045. Iter 32 (imitate 5) reverted at 1.0497, landing between 3 and 10 as expected; imitate axis exhausted, recipe fully converged at (imitate 3, gate 25/25, tau 1.0, gain_min 0.5). Best: iter-30 weights, 1.0451. Arm spend $5.39.
- **Next:** red 8 after blue 32 (re-mine vs the iter-30 keep); blue needs a new frontier (candidate-file changes) since recipe + fresh-data gains are exhausted on this pool.
