# M3d report: EMS evaluator compute gate, references, counterfactual and sensitivity

## Compute gate

From `judges/ems`, with no `runs/ems-ref/` present:

- cold (refs + candidate): `wall 91.22 s`, `seconds 90.1`, `METRIC ratio_b1=1.0000`, `regret_closed 0.0`, candidate `primary 11247.14150209779`
- warm (candidate only): `wall 30.66 s`, `seconds 29.6`, `METRIC ratio_b1=1.0000`, `regret_closed 0.0`, candidate `primary 11247.14150209779`

Both wall times under the 600 s gate: pass.

## References on 200 dev days

```
b1 11247.1 16.13
oracle 13278.5 16.45
ref 10759.4 16.13
oracle < b1 on 71 of 200
```

## Counterfactual report

`python -m ems.cf b1 2018-02-12 0`: `wall 15.36 s`, `factual_primary 1603.57`, `decision_points 22`, `sampled 20`.
Top 3 `best_alt` / `delta`: hold 0.0, hold 0.0, activate 0 0.0.

## Sensitivity

Primary, equal and steep ratios (b1 / b0) with 95% CI, n = 48 (`runs/sensitivity-48.json`, `wall 227.85 s`).

| setting | primary | equal | steep |
|---|---|---|---|
| central | 0.0413 [0.0373, 0.0462] | 0.0389 [0.0351, 0.0438] | 0.0444 [0.0402, 0.0494] |
| activate_lag_s=1800.0 | 0.0392 [0.0354, 0.0435] | 0.0369 [0.0332, 0.0411] | 0.0422 [0.0384, 0.0466] |
| activate_lag_s=5400.0 | 0.0407 [0.0364, 0.0459] | 0.0383 [0.0341, 0.0433] | 0.0439 [0.0394, 0.0491] |
| budget_frac=0.05 | 0.0622 [0.0579, 0.0681] | 0.0585 [0.0542, 0.0644] | 0.0669 [0.0625, 0.0727] |
| budget_frac=0.2 | 0.0247 [0.0215, 0.0295] | 0.023 [0.0197, 0.0276] | 0.0271 [0.0237, 0.032] |
| divert_triage_s=600.0 | 0.0413 [0.0373, 0.0462] | 0.0389 [0.035, 0.0438] | 0.0444 [0.0402, 0.0493] |
| divert_triage_s=1800.0 | 0.0413 [0.0374, 0.0462] | 0.039 [0.0351, 0.0439] | 0.0444 [0.0403, 0.0494] |
| divert_callback_p=0.075 | 0.0248 [0.0224, 0.0279] | 0.0221 [0.0198, 0.0252] | 0.0284 [0.0258, 0.0317] |
| divert_callback_p=0.175 | 0.0466 [0.0422, 0.0517] | 0.0441 [0.0398, 0.0491] | 0.05 [0.0455, 0.0552] |
| divert_callback_delay_s=3600.0 | 0.0091 [0.0079, 0.0108] | 0.0061 [0.0051, 0.0077] | 0.0129 [0.0116, 0.0149] |
| divert_callback_delay_s=43200.0 | 0.0824 [0.0733, 0.0928] | 0.0803 [0.0713, 0.091] | 0.0851 [0.0762, 0.0955] |

## Known limits

- the foresight oracle beats b1 on only 71 of 200 days; the per-day reference is about 4% below b1, so regret headroom against the reference is small;
- triage time has no effect, since a diverted call with no callback is never late;
- callback delay is the most sensitive setting;
- activation alternatives in counterfactual reports have only 15 min of effect inside the 60-min window.
