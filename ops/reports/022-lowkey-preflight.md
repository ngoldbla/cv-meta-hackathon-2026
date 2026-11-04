# Report 022: Low Key: finish the engineering preflight (data checks only; no app code)
Status: done
Branch head at start: 1ae2731c7487c1040c65017fb7b64dd46597207a  ·  at finish: (this commit)

## Summary
The data-only preflight is finished and the product plan holds, with corrections. P6, P7, P8 and P12 pass; P13 proposes one trade-in discount factor (0.85); P17 passes except heavy-duty pickups, which have no EPA rating. Retention is now measured against today's new price, which reverses the flattering old basis (a 2021 Tundra no longer "retains" 100%). P10, P15 and P16 are blocked on missing keys, as the task states.

## Work done
- Claimed the task on branch `low-key` (274d936). Stayed on `low-key` throughout.
- Parts 1–4 (67bc8f4): [provider_client.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/provider_client.py) (env-only keys, cache outside git, 1 request per 2 s, 429 backoff), [p6_sold_depth.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/p6_sold_depth.py), [analyze.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/analyze.py). 23 provider calls, no 429.
- Parts 5–8 (this commit): [p8_listings.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/p8_listings.py), [p12_mcp.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/p12_mcp.py), [p17_mpg.py](/home/ndgold/cv-meta-hackathon-2026/lowkey/preflight/p17_mpg.py); P13 from published KBB and Edmunds values. All numbers recorded in [preflight-results.md](/home/ndgold/cv-meta-hackathon-2026/lowkey/docs/preflight-results.md).
- `pytest -q`: 154 passed, 1 skipped. `scripts/name_guard.py`: pass.

## Results
- Usage: at task start 24 requests, 101000 charged micros; at finish 60 requests, 260000 charged micros. This task spent 36 requests, $0.159 of the $3.00 cap.
- P6 PASS: models with at least 30 sold per age — Sedan 27–52, SUV 80 (facet cap), Pickup 22–27, against a pass bar of 8. Sold history at 180 days runs 1.75–1.85x the 90-day counts.
- P7 PASS: fitted 5-year retention (new basis) Civic 0.77, CR-V 0.74, Tacoma 0.75 vs iSeeCars 2026 (0.77, 0.71, 0.80) and 2025 (0.72, 0.65, 0.74) — all within ±10 points. KBB's lower projections are trade-in basis; the gap is the P13 discount, and the fit was not tuned.
- Ranking (fitted 5y retention; $/mo depreciation): Sedan — Accord 0.77 ($120), Civic 0.77 ($109, also commodity), Civic Si 0.76, Mazda3 0.73, Elantra 0.71. SUV — CR-V 0.74 ($151), Corolla Cross 0.73, CX-50 0.70, 4Runner 0.69, Bronco 0.68; commodity Venue ($134). Pickup — Tacoma 0.75 ($196, also commodity), F-350 0.73, "1500" 0.72, F-250 0.71, Silverado 3500HD 0.70.
- P8 PASS: dense/suburban ZIPs hold 194–923 units per model at 50 miles; rural 59001 needed the 150-mile widening for the Accord Sedan (0 → 5).
- P12 PASS: MCP server exposes `search` and `execute`; a live local search through it took 0.70 s and covers the P8 search.
- P13: proposed discount factor 0.85 (15% off sold retail medians), from KBB and Edmunds private-party vs retail gaps of 11–15%.
- P17 PASS with gap: EPA combined MPG found for 13 of 16 ranked models; F-250, F-350 and Silverado 3500HD have no EPA rating (heavy-duty exemption).

## Deviations
- Stayed on branch `low-key`; the inbox skill's `git checkout main` step conflicts with the task file and Dylan's instruction, so it was not followed.
- P8 uses the #1 model per category (Accord Sedan, CR-V, Tacoma); the task says "one top model per category" without naming them.
- P17 reads the fueleconomy.gov downloadable dataset (the same EPA data behind the web service) because it needs no key; every value carries its EPA vehicle id.

## Blocked / questions
- P10, P15, P16 blocked: `META_API_KEY` and `EIA_API_KEY` are empty. Needs Dylan to set them.
- For Dylan: (1) Sedan #1 vs #2 (Accord 0.772, Civic 0.768) is inside noise — show both, or break the tie on $/mo (Civic wins)? (2) Heavy-duty trucks take 3 of the Pickup top 5 on percentage retention at $264–$323/mo — add a price/class guard for #1/#2, or let the commodity pick carry it? (3) Accept the 0.85 trade-in discount as the single factor? (4) Rural ZIPs can fall below 3 units per model even at 150 miles — is the card allowed to show 1–2 units there?
