# Report 008: M3b fix: refit hospital offload with a 24-hour surge ratio, checked on the Jan 2018 anchor days
Status: blocked
Branch head at start: 5c95093393c12c45baa5fc012f24b4c71d990ca4  ·  at finish: <sha-finish>

## Summary
Implemented the ratio24 offload refit (`fit_offload_ratio`, 24 h surge ratio) and the Jan 2018 anchor check (`jan2018_check`), rewired the bundle, and re-ran the full calibration. The check fails in every borough: observed flu-day offload medians rose 2.4–4.8% (matching the task premise), but the fitted betas are ≈0 to slightly negative, so the model predicts ≈1.000 everywhere. Per the task stop rule the window, tolerance and model were left unchanged and the task is blocked. No ledger entries written; nothing here is a finding.

## Work done
- Part 1 (model): added `fit_offload_ratio(df, window_s=86400)` to `judges/ems/ems/calibrate/offload.py` (`prior_load`, `fit_offload` untouched); added the task's `test_ratio_fit_recovers_a_known_slope` verbatim to `judges/ems/tests/test_offload.py`. `pytest judges/ems/tests/test_offload.py`: 3 passed. `ruff check` on both files: clean. Commit: `c194c5b`.
- Part 2 (check): added `jan2018_check(df, anchor, fit, tol=0.015)` to the same module (base days = 28 days before the first flu day minus flu days, mirroring `anchor_targets`; `UNKNOWN` skipped; plain floats/bools for JSON) plus `test_jan2018_check_known_obs_and_pred` (synthetic: obs 1.1, pred exp(0.1), ok True; UNKNOWN row skipped). `pytest`: 4 passed; `ruff check` and `ruff format --check`: clean. Commit: `475dd6d`.
- Part 3 (bundle): in `judges/ems/ems/calibrate/bundle.py`, `offload.json` now comes from `fit_offload_ratio(fit)`; added `offload_check.json` from `jan2018_check(df, anchor, offload_fit)`; fit report gains the surge-coefficient table (with `mean_load`) and the "Offload check (Jan 2018 anchor days)" table, and the stale "prior 2 h" header was rewritten (see Deviations). Restarted `osrm-ny` from `~/osrm-ny` on `127.0.0.1:5005` (route check `"code":"Ok"`, Bronx→Manhattan 1626.9 s, same as task 007); `python -m ems.calibrate.bundle` from `judges/ems` took 3:38.78 with identical counts to task 007 (4,238,644 rows / 1,027 fit days / 68 anchor days / 48 dropped); `verify_bundle` → BUNDLE_OK; container stopped and removed. Only `bundle_manifest.json`, `fit_report.md`, `offload.json` changed plus new `offload_check.json` — all other bundle bytes identical. Commit: <sha-part3>.
- Gates at finish: `pytest -q` → 100 passed, 1 skipped; `ruff check .` → clean; `scripts/name_guard.py` → exit 0.

## Results
New betas and means (`judges/ems/calibration/offload.json`):

| borough | beta | mean_load |
|---|---|---|
| BRONX | -0.0125 | 661.7 |
| BROOKLYN | -0.0222 | 782.3 |
| MANHATTAN | -0.0030 | 656.8 |
| QUEENS | -0.0156 | 535.9 |
| RICHMOND / STATEN ISLAND | 0.0107 | 118.0 |
| UNKNOWN | 0.0000 | 0.0 |

Jan 2018 check (`judges/ems/calibration/offload_check.json`, tol 0.015; also tabulated in `judges/ems/calibration/fit_report.md`):

| borough | obs | pred | ok |
|---|---|---|---|
| BRONX | 1.0479 | 0.9988 | false |
| BROOKLYN | 1.0322 | 0.9976 | false |
| MANHATTAN | 1.0274 | 0.9998 | false |
| QUEENS | 1.0243 | 0.9982 | false |
| RICHMOND / STATEN ISLAND | 1.0249 | 1.0010 | false |

Bundle size: 6,878,379 bytes (6.6 MB) for `judges/ems/calibration/`.

## Deviations
- The fit-report offload section header ("per extra transport ... in the prior 2 h") described the old model and would have been false for ratio24, so it now reads "Offload surge coefficient (ratio24: log offload per unit of 24 h load over the borough mean)" and shows `mean_load` alongside `beta`. Content change only; no numbers affected.
- `jan2018_check` is called with the full cleaned 2017–2019 frame rather than a 2017–2018 slice. This is exactly equivalent: the check only reads Dec 2017–Jan 2018 rows, and later rows cannot affect prior-24 h loads of earlier rows.
- Degenerate-input guard (not in the task text): a borough with no positive loads gets `mean_load` 0.0 and `beta` 0.0 instead of NaN (which would emit invalid JSON). Hit only by UNKNOWN (no two transported UNKNOWN rows within 24 h of each other; 3 hourly base tables still fitted).
- `ruff format` applied to `judges/ems/tests/test_offload.py` only, and only to the new Part 2 test; the verbatim Part 1 test is byte-identical to the task text. `bundle.py` was left in its existing hand style (it is not format-clean at baseline and format is not a repo gate).

## Blocked / questions
- **Blocked:** all 5 boroughs fail the 0.015 tolerance, so per the task the window, tolerance and model stay as specified. This looks like a true model failure, not a wiring bug: (a) the recovery test passes (slope 0.3 recovered); (b) the observed 2.4–4.8% range reproduces the task premise exactly, confirming the check wiring; (c) the fit itself finds day-to-day 24 h load variation does not predict offload (betas ≈0/negative over 1,027 fit days), so no surge-day prediction was possible from this term.
- **For Dylan / the reviewer:** next model direction needs a new task (e.g. a different surge covariate, or an offload model that does not lean on a load term). No pre-registration or ledger action needed — this was a dev-visible calibration fix, and none was claimed as a finding.
