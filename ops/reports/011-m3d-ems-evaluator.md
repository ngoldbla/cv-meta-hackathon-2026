# Report 011: M3d: EMS evaluator, scenarios, b1, counterfactual reports, benchmark and compute gate (plan Tasks 1-4)
Status: done
Branch head at start: 0794d03ea594f88dd3622500fd410af83a7fcbbc  ·  at finish: TBD

## Summary
Executed plan Tasks 1-4 from docs/superpowers/plans/2026-11-01-m3d-ems-evaluator.md exactly: frozen lever parameters, scenario bounds/sampler and simulator changes; b1 classical baseline with foresight oracle; frozen evaluator with paired claims and holdout gate plus counterfactual reports; blue-loop benchmark, compute gate, sensitivity sweep and report. All numbers match the plan's expected values (oracle 13278.5 vs plan 13279.x is within 0.5%). Dev days only; eval_holdout never called; no FROZEN, no ledger entries. Nothing here is a finding.

## Work done
- Claimed task 011 (3052621).
- Task 1: applied plan patch via mktemp + git apply (git apply --check passed); created ems/params.py, ems/scenarios/{__init__,bounds,sampler}.py, tests/test_scenarios.py with exact plan content. Targeted tests: 10 passed. Full gate: 113 passed, 1 skipped; name_guard exit 0; ruff clean (commit bc45822).
- Task 2: created ems/policy/classical.py, calibration/b1_params.json, tests/test_classical.py with exact plan content. Targeted tests: 2 passed. Full gate: 115 passed, 1 skipped; name_guard exit 0; ruff clean (commit fdf51b0).
- Task 3: created ems/evaluate.py, ems/cf.py, tests/test_evaluate.py with exact plan content. Targeted tests: 7 passed. Full gate: 122 passed, 1 skipped; name_guard exit 0; ruff clean (commit b77acbd).
- Task 4 Steps 1-2: created experiments/ar/ems_candidate.py and experiments/ar/ems_blue_bench.py with exact plan content. Full gate: 122 passed, 1 skipped; name_guard exit 0; ruff clean (commit 59e9d84).
- Task 4 Steps 3-6: compute gate, references, counterfactual report, sensitivity sweep (see Results). All commands run from judges/ems.
- Task 4 Steps 7-8: wrote judges/ems/calibration/m3d_report.md; journal entry appended. Full gate re-run before commit.

## Results

### Step 3: compute gate

`rm -rf runs/ems-ref`, then:

```
$ /usr/bin/time -f "wall %e s" ../../.venv/bin/python experiments/ar/ems_blue_bench.py --n 200   # cold
{"run": "runs/ar-blue-ems/20261101-164745", "seconds": 90.1, "summary": {"primary": 11247.14150209779, "equal": 10288.218198639635, "steep": 12534.536317162441, "tier1_p90_min": 16.128338140916885, "held_share": 0.12489740284413449, "unit_hours_extra": 494.28, "divert_share": 0.050193896783805876, "callbacks": 34.11}, "regret_closed": 0.0, "ratio_by_weighting": {"primary": 1.0, "equal": 1.0, "steep": 1.0}}
METRIC ratio_b1=1.0000
wall 91.22 s

$ /usr/bin/time -f "wall %e s" ../../.venv/bin/python experiments/ar/ems_blue_bench.py --n 200   # warm
{"run": "runs/ar-blue-ems/20261101-164818", "seconds": 29.6, "summary": {"primary": 11247.14150209779, "equal": 10288.218198639635, "steep": 12534.536317162441, "tier1_p90_min": 16.128338140916885, "held_share": 0.12489740284413449, "unit_hours_extra": 494.28, "divert_share": 0.050193896783805876, "callbacks": 34.11}, "regret_closed": 0.0, "ratio_by_weighting": {"primary": 1.0, "equal": 1.0, "steep": 1.0}}
METRIC ratio_b1=1.0000
wall 30.66 s
```

Both under the 600 s gate: pass.

### Step 4: references

```
b1 11247.1 16.13
oracle 13278.5 16.45
ref 10759.4 16.13
oracle < b1 on 71 of 200
```

### Step 5: counterfactual report

`../../.venv/bin/python -m ems.cf b1 2018-02-12 0 > runs/cf-b1-2018-02-12.json` (`wall 15.36 s`). Full file:

```json
{
 "day": "2018-02-12",
 "theta": {},
 "seed": 0,
 "policy": "b1",
 "factual_primary": 1603.5699835955706,
 "decision_points": 22,
 "sampled": 20,
 "highest_regret": [
  {"t": 22608.0, "queue": 3, "idle": 0, "chosen": "Divert(call=668)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}]},
  {"t": 22608.0, "queue": 3, "idle": 0, "chosen": "Divert(call=671)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}]},
  {"t": 22608.0, "queue": 3, "idle": 0, "chosen": "Activate(borough=0, n=3)", "best_alt": "activate 0", "delta": 0.0, "alts": [{"alt": "activate 0", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]},
  {"t": 22640.299711428303, "queue": 2, "idle": 1, "chosen": "Assign(call=672, unit=41)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}, {"alt": "divert", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]},
  {"t": 22682.364684874352, "queue": 2, "idle": 1, "chosen": "Assign(call=675, unit=158)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]},
  {"t": 22799.193039911654, "queue": 3, "idle": 1, "chosen": "Assign(call=676, unit=278)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}, {"alt": "divert", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]},
  {"t": 22859.864340429824, "queue": 3, "idle": 1, "chosen": "Assign(call=679, unit=487)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]},
  {"t": 22882.0, "queue": 3, "idle": 0, "chosen": "Divert(call=677)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}]},
  {"t": 22882.0, "queue": 3, "idle": 0, "chosen": "Activate(borough=3, n=3)", "best_alt": "activate 0", "delta": 0.0, "alts": [{"alt": "activate 0", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]},
  {"t": 22888.18739730472, "queue": 3, "idle": 0, "chosen": "Divert(call=678)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}]},
  {"t": 22888.18739730472, "queue": 3, "idle": 0, "chosen": "Divert(call=680)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}]},
  {"t": 22888.18739730472, "queue": 3, "idle": 0, "chosen": "Activate(borough=2, n=3)", "best_alt": "activate 0", "delta": 0.0, "alts": [{"alt": "activate 0", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]},
  {"t": 23033.528470145335, "queue": 2, "idle": 1, "chosen": "Assign(call=684, unit=132)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]},
  {"t": 23069.66100750364, "queue": 2, "idle": 1, "chosen": "Assign(call=683, unit=21)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]},
  {"t": 23095.44600682572, "queue": 2, "idle": 1, "chosen": "Assign(call=686, unit=144)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}, {"alt": "divert", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]},
  {"t": 23117.058713574115, "queue": 2, "idle": 0, "chosen": "Divert(call=685)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}]},
  {"t": 32334.85748581105, "queue": 3, "idle": 0, "chosen": "Divert(call=1107)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}]},
  {"t": 32334.85748581105, "queue": 3, "idle": 0, "chosen": "Activate(borough=0, n=3)", "best_alt": "activate 0", "delta": 0.0, "alts": [{"alt": "activate 0", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]},
  {"t": 32340.558355640453, "queue": 2, "idle": 1, "chosen": "Assign(call=1108, unit=302)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]},
  {"t": 32360.67979130038, "queue": 2, "idle": 1, "chosen": "Assign(call=1109, unit=272)", "best_alt": "hold", "delta": 0.0, "alts": [{"alt": "hold", "delta": 0.0}, {"alt": "activate 1", "delta": 0.0}]}
 ]
}
```

(All 20 sampled deltas are 0.0. Formatting condensed from the runs file; values identical.)

### Step 6: sensitivity sweep

`../../.venv/bin/python -m ems.cf --sensitivity 48 > runs/sensitivity-48.json` (`wall 227.85 s`). Full file:

```json
{
 "central": {"primary": [0.0413, [0.0373, 0.0462]], "equal": [0.0389, [0.0351, 0.0438]], "steep": [0.0444, [0.0402, 0.0494]]},
 "activate_lag_s=1800.0": {"primary": [0.0392, [0.0354, 0.0435]], "equal": [0.0369, [0.0332, 0.0411]], "steep": [0.0422, [0.0384, 0.0466]]},
 "activate_lag_s=5400.0": {"primary": [0.0407, [0.0364, 0.0459]], "equal": [0.0383, [0.0341, 0.0433]], "steep": [0.0439, [0.0394, 0.0491]]},
 "budget_frac=0.05": {"primary": [0.0622, [0.0579, 0.0681]], "equal": [0.0585, [0.0542, 0.0644]], "steep": [0.0669, [0.0625, 0.0727]]},
 "budget_frac=0.2": {"primary": [0.0247, [0.0215, 0.0295]], "equal": [0.023, [0.0197, 0.0276]], "steep": [0.0271, [0.0237, 0.032]]},
 "divert_triage_s=600.0": {"primary": [0.0413, [0.0373, 0.0462]], "equal": [0.0389, [0.035, 0.0438]], "steep": [0.0444, [0.0402, 0.0493]]},
 "divert_triage_s=1800.0": {"primary": [0.0413, [0.0374, 0.0462]], "equal": [0.039, [0.0351, 0.0439]], "steep": [0.0444, [0.0403, 0.0494]]},
 "divert_callback_p=0.075": {"primary": [0.0248, [0.0224, 0.0279]], "equal": [0.0221, [0.0198, 0.0252]], "steep": [0.0284, [0.0258, 0.0317]]},
 "divert_callback_p=0.175": {"primary": [0.0466, [0.0422, 0.0517]], "equal": [0.0441, [0.0398, 0.0491]], "steep": [0.05, [0.0455, 0.0552]]},
 "divert_callback_delay_s=3600.0": {"primary": [0.0091, [0.0079, 0.0108]], "equal": [0.0061, [0.0051, 0.0077]], "steep": [0.0129, [0.0116, 0.0149]]},
 "divert_callback_delay_s=43200.0": {"primary": [0.0824, [0.0733, 0.0928]], "equal": [0.0803, [0.0713, 0.091]], "steep": [0.0851, [0.0762, 0.0955]]}
}
```

(Formatting condensed from the runs file; values identical. Every primary CI upper end is below 0.1; max 0.0928.)

## Deviations
- Step 4 oracle primary is 13278.5 vs the plan's 13279.x (relative difference < 0.01%, within the 0.5% tolerance). No code, parameter, bound or threshold was changed.
- Wall-time prefixes (`/usr/bin/time`) were added to the Step 5 and Step 6 commands to record wall times; the commands themselves are otherwise as written.

## Blocked / questions
None. The freeze is a separate maintainer step after Dylan's review.
