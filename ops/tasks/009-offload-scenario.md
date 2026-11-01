---
id: "009"
title: "M3b fix 2: offload without a load term; surge offload becomes a bounded scenario factor"
status: done
created: 2026-11-01
report: ops/reports/009-offload-scenario.md
---
# M3b fix 2: offload as a scenario factor

**Why.** Task 008 showed that day-to-day ambulance load does not predict offload in the 2017–2019 fit days: the betas are about 0 or negative. The January 2018 rise (2.4–4.8%) is therefore not caused by load. Dylan decided on 2026-11-01:
- remove the endogenous load term;
- model surge offload as the stress-scenario factor θ "extra offload inflation" (spec §9), with its range measured from real pre-2020 days.

Work in the main checkout on `main`. Commit and push after each part. Install nothing.

## Part 1: base-only offload
- `offload.json` becomes `{"model": "base", "base": <101-point tables per borough and hour>}`. There is no beta and no load.
- Keep `fit_offload`, `fit_offload_ratio` and `jan2018_check` in the code for the record.
- Keep `offload_check.json` from task 008 as committed evidence of the null result, renamed `offload_load_null.json`, with a top-level `"note"` key explaining it.

## Part 2: the offload-inflation range
Add `offload_inflation_range(df) -> dict` in `ems/calibrate/offload.py`.
- Per borough, take each day's median `offload_s` divided by the median over the previous 28 days (all calibration days; at least 20 days with transports in the window).
- Return `{borough: {"p50", "p95", "p99", "max", "n_days"}}` over the 2017–2019 days.
- Write a unit test on synthetic days with a known maximum ratio.
- Add the result to the bundle as `offload_inflation.json`.
- The bound o_max for M3d will be the citywide maximum of `max`. Write that number in the fit report.
- This uses only the calibration window. The 2005–2015 bounds data has no offload times. Say so in the fit report.

## Part 3: the bundle and the fit report
- Re-run the bundle (OSRM on `127.0.0.1:5005` from `~/osrm-ny`; stop and remove it after), run `verify_bundle`, and commit and push.
- In the fit report, replace the beta table with:
  - the base-only statement;
  - the null-result table from task 008 (obs vs pred);
  - the inflation table.
- Add a line in `research/journal.md`.

## Stop and report
- The report contains the inflation table, o_max, the bundle size, test runs and commit SHAs.
- If anything differs from this task, block.
- Nothing here is a finding, and no ledger entries are written.
