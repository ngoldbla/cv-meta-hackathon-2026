---
id: "008"
title: "M3b fix: refit hospital offload with a 24-hour surge ratio, checked on the Jan 2018 anchor days"
status: blocked
created: 2026-11-01
report: ops/reports/008-offload-refit.md
---
# M3b fix: refit hospital offload

**Why.** In the bundle from task 007, the offload load term is too weak (betas 0.0003–0.0033). On the dev-visible January 2018 anchor days (`anchor_days.json` `flu_2018`), the observed median offload rose 2.4–4.8% by borough against the 28 days before. The fitted term predicts only 0.3–1.0%. A 2-hour arrival count is too short to see a surge day. Dylan approved a refit on 2026-11-01.

Work in the main checkout on `main`. Commit and push after each part. Install nothing.

## Part 1: the model
In `judges/ems/ems/calibrate/offload.py`, add `fit_offload_ratio(df, window_s=86400) -> dict`. Keep `prior_load` and `fit_offload` unchanged.
- **Load:** for each transported row, `load` = `prior_load(x, window_s=86400)`, the transports into the same borough in the previous 24 hours. Then `r = load / mean_load[borough]`, where `mean_load[borough]` is the mean of `load` over that borough's rows with `load > 0`.
- **Fit:** per borough, `y = log(offload_s) - log(median offload_s for that borough and hour)` and `z = r - 1`. `beta[borough]` is the least-squares slope through the origin: `sum(z*y) / sum(z*z)`.
- **Return:** `{"model": "ratio24", "window_s": 86400, "base": <same 101-point tables per borough and hour as fit_offload>, "mean_load": {borough: float}, "beta": {borough: float}}`.

Add this test to `judges/ems/tests/test_offload.py`, exactly as written (the reviewer has linted it):

```python
def test_ratio_fit_recovers_a_known_slope():
    from ems.calibrate.offload import fit_offload_ratio, prior_load

    rng = np.random.default_rng(0)
    base = rng.uniform(0, 60 * 86400, 30000)
    surge = rng.uniform(30 * 86400, 37 * 86400, 6000)
    t = pd.Timestamp("2019-01-01") + pd.to_timedelta(np.sort(np.concatenate([base, surge])), unit="s")
    df = pd.DataFrame({"borough": "BRONX", "t_hosp": t, "transported": True})
    load = prior_load(df, window_s=86400).to_numpy()
    r = load / load[load > 0].mean()
    df["hour"] = df["t_hosp"].dt.hour
    df["offload_s"] = 2000 * np.exp(0.3 * (r - 1) + rng.normal(0, 0.05, len(df)))
    fit = fit_offload_ratio(df)
    assert fit["model"] == "ratio24" and fit["window_s"] == 86400
    assert abs(fit["beta"]["BRONX"] - 0.3) < 0.05
    assert len(fit["base"]["BRONX"]["10"]) == 101 and fit["mean_load"]["BRONX"] > 0
```

## Part 2: the Jan 2018 check (pass rule fixed before the run)
Add `jan2018_check(df, anchor, fit, tol=0.015) -> dict` to the same module.
- `df` is the cleaned 2017–2018 data. The base days are the 28 days before the first `flu_2018` day, minus the `flu_2018` days.
- Per borough (skip `UNKNOWN`):
  - `obs` = the median `offload_s` on flu days divided by the median on base days;
  - `pred` = `exp(beta * (mean r on flu-day rows - mean r on base-day rows))`, with `r` computed as in Part 1 using `fit["mean_load"]`;
  - `ok` = `abs(pred - obs) <= tol`.
- Return `{borough: {"obs", "pred", "ok"}}`. Write a unit test with a small synthetic data set where pred and obs are known.

## Part 3: the bundle
In `ems/calibrate/bundle.py`:
- use `fit_offload_ratio(fit)` for `offload.json`;
- add the `jan2018_check` result as `offload_check.json`;
- add an "Offload check (Jan 2018 anchor days)" table to the fit report.

Re-run `python -m ems.calibrate.bundle` (OSRM must be running: restart `osrm-ny` from `~/osrm-ny` on `127.0.0.1:5005`, and stop and remove it after). Then run `verify_bundle`, and commit and push.

## Stop and report
- **Pass:** every borough has `ok: true`.
- **If any borough fails, block.** Report the obs and pred table. Do not change the window, the tolerance or the model.
- **The report contains:**
  - per-part test runs and commit SHAs;
  - the new betas;
  - the check table;
  - the bundle size.
- Nothing here is a finding, and no ledger entries are written.
