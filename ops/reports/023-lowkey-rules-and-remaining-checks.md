# Report 023: Low Key: apply the lineup rules, then run P10, P15 and P16
Status: in_progress
Branch head at start: 5977ef177408b5686b45be8aab777e8249ef5f49 · at finish: (this commit)

## Summary
In progress.

## Work done
- Stayed on branch `low-key` throughout (pulled `origin/low-key` first). The inbox skill's `git checkout main` step was not followed, per this task's own instruction ("Ignore the inbox skill's `git checkout main` step for this task") and Dylan's instruction to work only on `low-key`.
- Part 1 (this commit): [lineup.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/lineup.py) (pure ranking logic), [test_lineup.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/test_lineup.py) (9 fixture tests), [make_map.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/make_map.py) (model→make resolution). Lineups recorded in [preflight-results.md](/home/ndgold/cv-meta-hackathon-2026/lowkey/docs/preflight-results.md). A single `facets=make,model` call returns the two lists unpaired (verified live), so makes were resolved with per-make `facets=model` calls instead: 64 provider requests in this part.

## Results
- Provider usage: 60 requests / 260,000 charged micros at session start; 124 requests / 452,000 micros after part 1. Part 1 spent 64 requests, $0.192 of the $1.00 cap.
- Lineups (retention after the 15% discount; retail fit in parentheses; full sample sizes in preflight-results.md):
  - Sedan: #1 Honda Accord Sedan 0.656 (0.772) $180/mo; #2 Honda Civic Sedan 0.653 (0.768) $163/mo (also commodity, `badge`); #3 Mazda Mazda3 Sedan 0.623 $172/mo; #4 Hyundai Elantra 0.599 $166/mo. Civic Si Sedan skipped as the third Honda.
  - SUV: #1 Honda CR-V 0.629 (0.741) $216/mo; #2 Toyota Corolla Cross 0.623 $206/mo; #3 Mazda CX-50 0.596 $241/mo; #4 Toyota 4Runner 0.585 $404/mo; commodity `extra` Hyundai Venue $176/mo.
  - Pickup: #1 Toyota Tacoma 0.633 (0.745) $281/mo; #2 Ram 1500 ("1500") 0.609 $364/mo; #3 Chevrolet Colorado 0.564 $310/mo; #4 Chevrolet Silverado 1500 0.560 $378/mo; commodity `extra` Ford Maverick $264/mo. Heavy-duty excluded: Ram 2500, Silverado 2500HD, F-250, Sierra 2500HD, Silverado 3500HD, F-350.

## Deviations
- Part 1 follows the PRD as pulled (four picks, at most 2 per make), which task 024 amended while this task was starting, rather than task 023's superseded two-pick text. The two-pick result is noted in preflight-results.md for comparison (only the Sedan #2 changes). Task 024's parts 1–2 are therefore already satisfied by this work; only its part 3 (P8 spot-check of the new #3/#4 at ZIP 60614) remains, left for that task.
- Make resolution used per-make facet calls (64 requests) instead of the single `facets=make,model` call the task suggested, because that call does not pair makes with models.

## Blocked / questions
Pending.
