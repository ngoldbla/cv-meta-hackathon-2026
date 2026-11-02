id: EMS5
status: exploratory (derived from M5 results; registered before any holdout run)
claim: In the frozen EMS simulator, a citywide capacity-reservation hold rule cuts weighted lateness by at least 5% against b1 on real and stressed surge days, and is not more than 2% worse on normal days. The rule belongs to a known policy class (cutoff-priority dispatch: Taylor & Templeton 1980; Schaack & Larson 1986; stacking of low-acuity calls in UK services; research/literature/2026-11-02-hold-rule-prior-art.md). The M5 loops rediscovered it without being given that literature; EMS5 tests the settings they found, not a new idea.
primary_metric: weighted lateness L per scenario-day, exactly as EMS1 (evaluator ems-1.1, judges/ems/ems/evaluate.py, sha256 33bf0058e5cc7e929f93350d6e991e3ddf4a12130b2f67c347379c5b7f6cc0c7)
policies:
  NO_CF: research/m6/final/no-cf/ems_candidate.py (sha256 24b9144c3763ca686f7acce7c32bd296dc9ace5d8ba0db93e9d10305a8dc144e; no weights). b1 plus: hold a new tier-3 call for 5 minutes when fewer than 5 units are free citywide, and a new tier-2 call when fewer than 4 are free; only calls that have waited under 5 minutes; tier 1 never held.
  BLUE_ONLY: research/m6/final/blue-only/ems_candidate.py (sha256 4ac13693e4301732803070a383b3e1bb029554a3ec73574b0082252b62478774) with ems_candidate.npz (sha256 633c3c50bb92a6af5baf04957ec35f73530465aacc1ea81bd56d203183463be5). b1 with 2-unit activations plus a learned unit scorer that holds about 2.6% of calls (dev); its written hold rule never fires (research/m6/ablation.json).
  both import judges/ems/emslearn/policy.py (sha256 bc52e937ae58c83e296fe12c283b89dc3b56d786b0481b04845a3fa2ad0af95f) and emslearn/__init__.py (sha256 a9fa9760f051d734735bfe5857b32f180bc9c45bcaae4a7d0d29d91f98c30738); these files are part of the policies and are not changed before the run.
comparisons: [NO_CF, b1], [BLUE_ONLY, b1]
pools: omicron-b, covid-a, stress (surge pools); normal-2016 (safety pool). Same windows, seeds and n as EMS1.
threshold: decided per policy from the eval_holdout report, one run over all four pools:
  benefit: for each surge pool and each weighting (primary 8:3:1, equal 1:1:1, steep 20:5:1), the ratio's 95% CI upper end is below 0.95 and the Holm-adjusted p is below 0.05 (9 tests);
  safety: for normal-2016 and each weighting, the ratio's 95% CI upper end is at most 1.02 (3 tests; their p-values are not used).
  A policy's claim stands only if all 12 of its conditions hold. Anything else is a reported null. eval_holdout's own claim_stands field uses the stricter EMS1 rule (all 24 tests below 0.95); it is recorded and reported, but it is not the EMS5 decision.
test: as EMS1: ratio of mean L with a paired bootstrap 95% CI (2000 resamples, seed 0) over scenario-days, paired Wilcoxon p (loopkit.stats.paired); Holm across all 24 tests that eval_holdout computes (2 comparisons x 4 pools x 3 weightings).
n_holdout_instances: omicron-b 96, covid-a 93, normal-2016 1098, stress 1098 scenario-days (32/31/366/366 days x seeds 0, 1, 2), common random numbers across policies.
reported_without_decision: per pool and tier: mean, median and 90th-percentile response time; extra unit-hours; divert share; held share. Prior work (Jagtenberg et al. 2017) found a similar policy cut late arrivals while raising mean response time 37%; EMS5 reports mean response so that trade-off is visible.
deviations_disclosed:
  - Ledger seq 20 fixed a selection rule (the final candidate with the lowest fresh-pool primary ratio, which is BLUE_ONLY). EMS5 tests NO_CF as well, with Holm across both. This change was made after the pre-M6 re-check results were read (research/m6/recheck.json), because they showed BLUE_ONLY is worse than b1 on calm days.
  - The benefit-plus-safety bar replaces EMS1's all-pools bar for this claim. It was chosen after dev results showed that the hold rules help only on busy days (research/m6/recheck.json, research/m6/ablation.json).
  - COVID-A summary statistics were seen during design (2026-10-29), as in EMS1-EMS4; Omicron-B is the main real-surge pool.
  - The M5 dev numbers that motivated EMS5 are exploratory: about 40 kept-or-reverted tries per arm against fixed dev pools.
notes: Holdout data never leaves dylan-pc. EMS1-EMS4 run as registered, each once, in the same session as EMS5. The thresholds are absolute unit counts for the simulated NYC fleet (about 200 units on duty at busy times). This is simulation research: a pass is evidence for a shadow trial, not approval for dispatch use; clinical review must assess mis-triage risk for held calls.
