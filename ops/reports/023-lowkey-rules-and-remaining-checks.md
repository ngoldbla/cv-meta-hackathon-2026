# Report 023: Low Key: apply the lineup rules, then run P10, P15 and P16
Status: in_progress
Branch head at start: 5977ef177408b5686b45be8aab777e8249ef5f49 · at finish: (this commit)

## Summary
In progress.

## Work done
- Stayed on branch `low-key` throughout (pulled `origin/low-key` first). The inbox skill's `git checkout main` step was not followed, per this task's own instruction ("Ignore the inbox skill's `git checkout main` step for this task") and Dylan's instruction to work only on `low-key`.
- Part 1 (this commit): [lineup.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/lineup.py) (pure ranking logic), [test_lineup.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/test_lineup.py) (9 fixture tests), [make_map.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/make_map.py) (model→make resolution). Lineups recorded in [preflight-results.md](/home/ndgold/cv-meta-hackathon-2026/lowkey/docs/preflight-results.md). A single `facets=make,model` call returns the two lists unpaired (verified live), so makes were resolved with per-make `facets=model` calls instead: 64 provider requests in this part.
- Part 2 (this commit): [p10_spark_tools.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/p10_spark_tools.py). Two full 10-prompt runs (baseline prompt, then one prompt change, kept): see Results.
- Part 3 (this commit): [p15_gas.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/p15_gas.py). All 29 EIA area series pulled (cache outside git); ZIP map in the script (USPS ZIP3 table + EIA PADD membership).
- Part 4 (this commit): [p16_forecast.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/p16_forecast.py), run with `~/.cache/low-key/venv-timestral/bin/python` (Timestral-28M + CPU torch installed there only). Backtest: 29 series × 5 origins × 52 weeks.

## Results
- Provider usage: 60 requests / 260,000 charged micros at session start; 124 requests / 452,000 micros after part 1. Part 1 spent 64 requests, $0.192 of the $1.00 cap.
- Lineups (retention after the 15% discount; retail fit in parentheses; full sample sizes in preflight-results.md):
  - Sedan: #1 Honda Accord Sedan 0.656 (0.772) $180/mo; #2 Honda Civic Sedan 0.653 (0.768) $163/mo (also commodity, `badge`); #3 Mazda Mazda3 Sedan 0.623 $172/mo; #4 Hyundai Elantra 0.599 $166/mo. Civic Si Sedan skipped as the third Honda.
  - SUV: #1 Honda CR-V 0.629 (0.741) $216/mo; #2 Toyota Corolla Cross 0.623 $206/mo; #3 Mazda CX-50 0.596 $241/mo; #4 Toyota 4Runner 0.585 $404/mo; commodity `extra` Hyundai Venue $176/mo.
  - Pickup: #1 Toyota Tacoma 0.633 (0.745) $281/mo; #2 Ram 1500 ("1500") 0.609 $364/mo; #3 Chevrolet Colorado 0.564 $310/mo; #4 Chevrolet Silverado 1500 0.560 $378/mo; commodity `extra` Ford Maverick $264/mo. Heavy-duty excluded: Ram 2500, Silverado 2500HD, F-250, Sierra 2500HD, Silverado 3500HD, F-350.

- P10: PASS with the kept prompt. `muse-spark-1.3`, `max_tokens` 4000, no reasoning-effort parameter (at 1600, reasoning used 1598/1600 tokens and replies were empty). Iteration log (metric: prompts with the right tools, of 10; numbers must also be 10 of 10):
  - Baseline system prompt: tools 9/10 (case "Show me sedans near 60614" called only `local_units`), numbers 10/10; 40,166 tokens (18,558 reasoning); latency 10.5–32.7 s per prompt.
  - One change (system prompt: any category mention is a ranking request; a ZIP never replaces it): tools 10/10, numbers 10/10 — kept. 46,686 tokens (23,117 reasoning); latency 17.9–33.9 s per prompt. Three payment prompts also called `rank_category` as an extra; every required tool was called.
  - The API reports tokens only, so Meta spend is reported as tokens (86,852 across the two full runs, plus about 13k probe tokens) against the $2.00 cap.
- P15: PASS. 29 series pulled (US, 5 PADDs, 3 PADD 1 sub-districts, PADD 5 ex-CA, 9 states, 10 cities); shortest history 23.4 years. Test ZIPs: 60614 → Chicago (city, 26.4y), 30097 → PADD 1C (33.6y), 59001 → PADD 4 (34.5y). EIA direct states: CA, CO, FL, MA, MN, NY, OH, TX, WA. Direct cities: Boston, Chicago, Cleveland, Denver, Houston, Los Angeles, Miami, New York City, San Francisco, Seattle. EIA is free.
- P16: PASS (pooled). 7,540 series-weeks: 10th–90th coverage 77.0% (bar 70%), median MAE $0.396/gal vs flat $0.418/gal. Coverage passed in 29/29 series; the median beat flat in 17/29 series, losing across the East Coast including PADD 1C (ZIP 30097's series; $0.337 vs $0.304). Timestral licence recorded: code Apache-2.0; weights Modified MIT with the $20M monthly-revenue cap (no rights above it, derivatives included; attribution required) — checked per AGENTS.md, must be re-checked before production use. No Modal used.

## Deviations
- Part 1 follows the PRD as pulled (four picks, at most 2 per make), which task 024 amended while this task was starting, rather than task 023's superseded two-pick text. The two-pick result is noted in preflight-results.md for comparison (only the Sedan #2 changes). Task 024's parts 1–2 are therefore already satisfied by this work; only its part 3 (P8 spot-check of the new #3/#4 at ZIP 60614) remains, left for that task.
- Make resolution used per-make facet calls (64 requests) instead of the single `facets=make,model` call the task suggested, because that call does not pair makes with models.

## Blocked / questions
Pending.
