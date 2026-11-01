---
id: "007"
title: "M3b: EMS data ingest and calibration bundle (plan Tasks 1-10)"
status: open
created: 2026-11-01
report: ops/reports/007-m3b-ems-data-calibration.md
---
# M3b: EMS data ingest and calibration bundle

Read these first:
- `AGENTS.md`;
- `docs/superpowers/specs/2026-11-01-m3-ems-judge-design.md` §3, §5, §6, §7;
- the plan `docs/superpowers/plans/2026-11-01-m3b-ems-data-calibration.md`.

**Prerequisite (it holds; check it):** M3a is applied. `judges/cages/FROZEN` exists, and `research/ledger.jsonl` ends with seq 11 `evaluator_update`.

Then execute plan **Tasks 1–10** as written, in order. The runner adaptations below override the plan where they differ.

## Reviewer pre-flight (2026-11-01)
- **Lint:** ruff over every complete Python block in the plan (repo config; `loopkit`, `cages` and `ems` first-party) is clean.
- **`pyproject.toml`:** the strings Task 1 edits match exactly once each.
- **Socrata:** the CSV endpoint returns a `:id` column, and keyset paging (`$order=:id`, `:id > 'last'`) continues at the next incident.
- **Port 5000 is taken on dylan-pc,** so the plan now publishes OSRM on `127.0.0.1:5005`.
- **External downloads reachable:**
  - the Census 2020 ZCTA Gazetteer (200, 1 MB);
  - the Geofabrik `new-york-latest.osm.pbf` (200, 498 MB);
  - `ghcr.io/project-osrm/osrm-backend:latest`.

## Runner adaptations
1. **Where to work:** the main checkout (`/home/ndgold/cv-meta-hackathon-2026`), on branch **`main`**.
   - Skip Task 1 Step 1's `git switch -c m3b-ems-data`, but do its pinned install.
   - Commit each plan task with the message the plan gives, and push after each (`git pull --no-rebase` first).
2. **The plan's header** names a sub-skill you don't have; ignore it. In the report, record for each plan task:
   - the tests written;
   - the first lines of the failing run;
   - the passing run;
   - the commit SHA.
3. **`pip`:** run only the two `pip` commands in Task 1: the pinned `pandas`, `pyarrow` and `numpy` install, and `pip install -e . -q --no-deps`. Nothing else.
4. **Network steps** (Task 3 Step 7; Task 9 Step 5; Task 10 Step 5): record wall time and data volume for each.
   - If a Socrata row count doesn't match `count(*)`, stop.
   - **Never download rows for a holdout window.** Their manifests are counts only.
5. **OSRM:** keep `osrm-ny` running until Task 10 Step 5 finishes. Then run `docker stop osrm-ny && docker rm osrm-ny`, and keep `/mnt/data1/osrm-ny/`.
6. **Task 10 Step 6:** push to `main`, not a branch. Then **stop.** Dylan reviews the fit report before M3c starts. Don't begin M3c.

## Stop and report
- **Stop on any mismatch.** If an expected output differs from the plan, or a fit-report sanity check in Task 10 Step 5 fails (fleet medians implausible, any offload beta < 0, normal-anchor tier-1 p90 far from about 10 min), record it under *Blocked / questions* and stop. Never tune by hand.
- **The report contains:**
  - each plan task, as in adaptation 2;
  - the rows per calibration year and the holdout counts;
  - the fleet median per borough (from `fleet.json`, over hours with at least 3 onsets);
  - the offload beta per borough;
  - the normal-anchor p50 and p90 per tier;
  - the flu held-share increase;
  - the bundle size and the run times.
- **Nothing here is a finding.** No ledger entries are written: the `dataset_release` is recorded at the M3d freeze.
