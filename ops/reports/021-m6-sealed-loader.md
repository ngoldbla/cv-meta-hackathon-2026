# Report 021: M6: sealed-data loader and confirm script (build and test only; no sealed run)
Status: done
Branch head at start: 413c47aa5b37ca143f9d77cd1d92c8b16b4920d8  ·  at finish: <sha>

## Summary
Built `judges/ems/scripts/confirm.py`, the single script for the M6 confirmatory
runs (ledger-gated sealed download, manifest check, dev-identical day tables,
pools_for, hash-checked policies_for, check/run/dry-run CLI), plus 11 unit
tests in `judges/ems/tests/test_confirm.py`. Verified: `check` all green;
day-table equivalence exact on a 3-day dev window (18/18 arrays); `dry-run`
ran the real `eval_holdout` on dev days with a temp ledger (24 tests, report
produced, real ledger byte-identical). `confirm.py run` was never invoked, no
sealed row was downloaded, the ledger was never appended to, no frozen path
was touched, no Modal was used.

## Work done
- Claimed task 021 (commit cd9469c).
- Built `judges/ems/scripts/confirm.py` and `judges/ems/tests/test_confirm.py`;
  `confirm.py check` green (commit bc65662).
- Day-table equivalence probe (`/tmp/equiv_probe.py`, throwaway, dev only):
  2018-03-01..2018-03-03 via normal `socrata.fetch_csv_rows`, 11755 rows,
  `sealed_day_tables` vs cached `data/cache/days/*.npz`: 18 arrays, 0 mismatches.
- `confirm.py dry-run --workers 8` (dev days only, temp ledger): 20
  scenario-days x 3 EMS5 policies, 24 tests, full report; ledger sha256
  `5128cdb39259...` before and after (unchanged).
- Gates: full `pytest -q` 154 passed + 1 skipped; `ruff check .` clean;
  `scripts/name_guard.py` clean; `scripts/guard_paths.py` clean on all touched files.

## Results
`confirm.py check` (no network), run from `judges/ems/`:
- ledger chain verifies (22 entries); EMS1/2/3/4/5 match seq 16/17/18/19/21;
  M5 candidates pinned at seq 20; all 6 final files match; EMS5 pins verify
  (5 files incl. emslearn/policy.py and __init__.py); counts
  {omicron-b: 96, covid-a: 93, normal-2016: 1098, stress: 1098}; no holdout_eval.
- evaluator ems-1.1 (33bf0058e5cc, matches the EMS5 pin); windows
  omicron-b 2021-12-15..2022-01-15 (141950 rows), covid-a 2020-03-16..2020-04-15
  (161820), normal-2016 2016-01-01..2016-12-31 (1441211, also under stress).

Day-table equivalence: days 2018-03-01/02/03; arrays t,z,b,tier,g,held_obs per
day (18 total); mismatches 0. The sealed path builds days exactly as the dev cache.

Dry-run summary (plumbing probe, not a result): 5 dev days x 1 seed per pool
(20 distinct dev days; stress pool reuses five theta dicts from
stress-pool.json on dev days, dates ignored); EMS5 policies
(no-cf file:, blue-only file:, b1); 24 tests; claim_stands=False on this tiny
dev probe, as expected and meaningless. Ledger sha256 before
`5128cdb39259a04782ed137b6fa30f43581b71e616513229468ad81a5a2584c8`, after
identical.

Nominal theta: `{}` (empty dict). perturb() defaults missing keys to demand
1.0 / urgent_share 1.0 / zero concentration, build_sim defaults missing
offload/unavailable to 1.0/0.0, and bounds.check({}) passes (load 1.0); the
frozen sampler defines no other identity, so {} is the no-perturbation theta.

Test counts: 11 new in test_confirm.py (fetch gate x3 + paging, verify count,
policies refuse/map, pools counts, EMS5 pins, nominal identity); EMS suite 71
passed; full repo `pytest -q` 154 passed, 1 skipped.

## Deviations
- `_m5_candidates` finds the hash entry by topic ("M5 final candidates
  (pre-M6)") rather than raw seq index, so unit tests can use small temporary
  ledgers as the task requires; `check` additionally asserts that entry sits at
  seq 20 on the real ledger. Same hashes, same gate.
- `dry-run` uses the real EMS5 policies (both file: candidates incl. weights)
  rather than b0/b1, to prove candidate loading end-to-end on dev data.
- Sealed tables are kept in memory only; `run` writes nothing under
  data/cache/. Run-time window SHAs go to `research/m6/holdout/sealed_windows.json`
  (stdout too), never into the frozen manifests; per-prereg reports are the
  frozen evaluator's blob verbatim.
- `run` keeps eval_holdout's defaults ratio_max=0.95, alpha=0.05, matching all
  five preregs.

## Blocked / questions
- Nothing blocked. Two expressibility notes for the reviewer (both by design,
  script behaves as tasked):
  - EMS5's benefit-plus-safety decision (9 surge tests < 0.95; 3 normal-2016
    tests <= 1.02, p unused) is a reading of the tests table in
    `research/m6/holdout/EMS5.json`, not eval_holdout's claim_stands field
    (EMS1 rule). The script writes the report verbatim and does not compute
    the EMS5 decision.
  - EMS5's reported_without_decision per-tier median/p90 response times are not
    in eval_holdout's report (summary has means + tier1_p90 only, rows are not
    saved). Computing them needs a separate non-confirmatory analysis pass over
    sealed sims, which this task does not ask for; flagging so the reviewer can
    task it if wanted.
