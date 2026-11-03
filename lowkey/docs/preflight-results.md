# Low Key: preflight results

*Running log. Raw provider responses are kept outside the repo (license §5–6); only counts and decisions are recorded here.*

## 2026-11-03

- **P2 Keys and credit: PASS.**
  - The free usage check returned HTTP 200 with 0 requests charged.
  - $25 of paid credit is on the account, which starts the Tier 2 clock.
  - The token was pasted into a chat session; rotate it after preflight.
- **P3 Body types: PASS.**
  - New-inventory `body_type` values include `SUV` (1.86M), `Pickup` (774k) and `Sedan` (313k). The mapping is one-to-one with the three categories.
  - Listings carry `vdp_url` (the dealer's listing link), `price_with_fees`, `selected_price`, `estimated_dealer_fees`, `days_on_market`, `distance_miles` and `dealer_name`.
- **P4 Fuel labels: PASS, with a rule.**
  - `fuel_type=Gas only` **includes mild hybrids**: all 239k MHEV units are labelled "Gas only".
  - The strict no-hybrid filter is `fuel_type=Gas only` plus `exclude_powertrain_type=MHEV,HEV`.
  - For Toyota and Honda the two filters give the same counts.
  - Open: whether Flex-fuel (63k, mostly domestic trucks and SUVs) counts as gas. Proposed: yes, since it runs on ordinary gas.
- **P5 Which expected winners qualify: changes the PRD.**
  - New **Camry**: 34,500 HEV vs 13 combustion. Hybrid-only, so **out**.
  - New **RAV4**: 24 gas units out of 43,933. **Out.**
  - **Sequoia** and **Land Cruiser** have essentially no gas units. **Out.**
  - **Still in:**
    - Sedans: Corolla, Accord, Civic (and Civic Si).
    - SUVs: CR-V (27k gas of 47k), HR-V, Corolla Cross, Pilot, Passport, 4Runner (10.8k gas of 14.7k), Grand Highlander, Highlander.
    - Pickups: Tacoma (46.7k gas of 52.4k), Tundra (26.5k of 33.1k), Ridgeline.
  - **Data note:** "new" inventory includes a few old model years, such as a 2008 Camry. Rank and price only current model years.

## 2026-11-03 (task 022, runner)

Provider usage for the whole account on 2026-11-03: 24 requests, 101000 charged micros ($0.101) at task start (includes the reviewer's P2–P5 calls and one probe).

- **P6 Sold depth: PASS (all three categories).**
  - Models with at least 30 sold units in 90 days, by category and model year (facet list capped at 80 models):
    - Sedan: 2021: 52, 2022: 50, 2023: 49, 2024: 35, 2025: 27.
    - SUV: 80 (cap) every year.
    - Pickup: 2021: 22, 2022: 27, 2023: 23, 2024: 26, 2025: 22.
  - The pass rule (at least 8 such models per category) clears by 3–10x everywhere, including Pickup, which the reviewer could not finish for 429s. Serial requests at 1 per 2 s drew no 429.
  - Sold history reach (Sedan totals, all models): 90-day totals 15,247–25,379 per model year vs 180-day totals 26,788–46,811. Widening to 180 days grows counts 1.75–1.85x at every age, so sold history reaches at least 180 days back at usable depth.
- **Retention basis fixed (task part 2).** Old basis = sold median / original MSRP of the same sold set. New basis = sold median / median price of new current-model-year (2026) units of the same model, strict gas filter. Age-5 values (age = 2026 − model year):
  - Sedan: Accord Sedan n=1262 old 0.80 new 0.76; Civic Sedan n=697 old 0.87 new 0.74; Mazda3 Sedan n=212 old 0.63 new 0.73; Elantra n=810 old 0.78 new 0.70; WRX n=467 old 0.79 new 0.69; Corolla n=1124 old 0.88 new 0.67; K5 n=669 old 0.72 new 0.67; IS n=356 old 0.82 new 0.66; Jetta n=664 old 0.75 new 0.66; Sentra n=893 old 0.77 new 0.64; Sonata n=726 old 0.64 new 0.62; Altima n=800 old 0.66 new 0.61.
  - SUV: CR-V n=1330 old 0.82 new 0.73; 4Runner n=1078 old 0.89 new 0.68; Bronco n=666 old 0.77 new 0.68; CX-30 n=687 old 0.73 new 0.67; CX-5 n=1413 old 0.77 new 0.65; Sorento n=594 old 0.58 new 0.63; Forester n=1326 old 0.74 new 0.63; Trailblazer n=973 old 0.70 new 0.63; Crosstrek n=1342 old 0.78 new 0.63; Bronco Sport n=1743 old 0.68 new 0.61; RX n=657 old 0.77 new 0.61; Durango n=965 old 0.58 new 0.60.
  - Pickup: Tacoma n=2013 old 0.92 new 0.74; Silverado 3500HD n=34 old 0.88 new 0.72; F-250 n=161 old 0.80 new 0.71; Tundra n=756 old 1.00 new 0.70; Sierra 2500HD n=94 old 0.79 new 0.67; Silverado 2500HD n=221 old 0.85 new 0.67; Ranger n=940 old 0.75 new 0.66; Silverado 1500 n=4039 old 0.68 new 0.66; Colorado n=623 old 0.75 new 0.66; Gladiator n=1710 old 0.63 new 0.65; Frontier n=244 old 0.73 new 0.62; Ridgeline n=227 old 0.66 new 0.62.
  - The old basis flatters exactly as the reviewer found (Corolla 0.88 old vs 0.67 new; Tundra 1.00 old, an impossible retention, vs 0.70 new). All rankings below use the new basis. Full per-age tables: `lowkey/preflight/analyze.py` output (cached outside git).
- **P7 Curve sanity: PASS against observed resale studies; KBB gap explained, fit not tuned.**
  - Fit: per model, log(retention on the new basis) = a + b·age, least squares over ages 1–5 with n at least 30 per age. Fitted 5-year retention: Civic Sedan 0.77 (ages n = 692, 1768, 1183, 1131, 697), CR-V 0.74 (983, 2462, 826, 1136, 1330), Tacoma 0.75 (1897, 2155, 3246, 1849, 2013). Retention declines with age for all three.
  - Published 5-year retention (1 − depreciation): iSeeCars 2026 study (950k 5-year-old cars sold Mar 2025–Feb 2026): Tacoma 80.1%, Civic 77.1%, CR-V 71.1% (https://www.iseecars.com/cars-that-hold-their-value-study). Differences from our fit: Tacoma −5.6 points, Civic −0.3, CR-V +3.0. All within ±10 points: PASS.
  - Second study: iSeeCars 2025 edition (800k cars): Tacoma 74.0%, Civic 72.0%, CR-V 64.8%. Differences: +0.5, +4.8, +9.3. All within ±10 points.
  - KBB 2025 Best Resale Value Awards project Tacoma 64.1% and Civic 51.5% at 5 years (https://www.aftermarketmatters.com/national-news/2025-best-resale-value-award-winners/). Our retail-median fit sits 10–25 points higher. That is a basis difference, not a fit error: KBB projects trade-in-basis value, while our sold medians are dealer retail prices. The P13 discount below is the correction; the fit was not tuned.
- **Provisional ranking (task part 4; preflight evidence, not the product answer).** By fitted 5-year retention on the new basis, pre-trade-in-discount; dollars per month = new price × (1 − retention at 5y) / 60:
  - Sedan top 5: Accord Sedan 0.77 ($120/mo), Civic Sedan 0.77 ($109/mo), Civic Si Sedan 0.76 ($134/mo), Mazda3 Sedan 0.73 ($122/mo), Elantra 0.71 ($122/mo). Commodity pick: Civic Sedan, $109/mo (also #2).
  - SUV top 5: CR-V 0.74 ($151/mo), Corolla Cross 0.73 ($146/mo), CX-50 0.70 ($178/mo), 4Runner 0.69 ($303/mo), Bronco 0.68 ($285/mo). Commodity pick: Venue 0.68 ($134/mo).
  - Pickup top 5: Tacoma 0.75 ($196/mo), F-350 0.73 ($264/mo), "1500" 0.72 ($264/mo; model name as returned by the provider), F-250 0.71 ($279/mo), Silverado 3500HD 0.70 ($323/mo). Commodity pick: Tacoma, $196/mo (also #1).
  - Sample sizes per age are in the analysis output; every ranked model has n at least 30 at each fitted age except where noted in the report (F-350 age 5 n=23 was excluded from its fit).
- **P8 Local price search: PASS.**
  - Units in stock within 50 miles (top model per category): 60614 (dense): Accord Sedan 351, CR-V 923, Tacoma 194. 30097 (suburban): 297, 490, 384. 59001 (rural): Accord Sedan 0, CR-V 6, Tacoma 4.
  - Widening to 150 miles was needed once: Accord Sedan near 59001, 0 units at 50 miles, 5 at 150. The PRD's widening rule covers the rural case; a rural sedan buyer may still face a thin choice.
  - Listings carry `vdp_url` (dealer listing link), `selected_price`, `price_with_fees` and `distance_miles`, as the PRD's cards require.
- **P12 MCP check: PASS.**
  - The listings provider's hosted MCP server answers with 2 tools: `search` (query, limit: finds API operations and their parameter schemas) and `execute` (runs JavaScript against the provider's SDK). Initialize 0.13 s, tools/list 0.13 s.
  - One local search through `execute` (new Tacoma, in stock, ZIP 30097, radius 50, cheapest first, strict gas filter) returned priced units with dealer, distance and listing link in 0.70 s. The MCP surface covers the P8 search with the same parameters and filters as REST, so no `local_units` fallback tool is needed for search.
- **P13 Trade-in discount: one factor proposed, 0.85 (15% off the provider's sold retail median).**
  - Provider sold retail medians: Civic Sedan age 3 $24,589 (n=1183), age 5 $20,926 (n=697); CR-V age 3 $29,975 (n=826), age 5 $25,507 (n=1330); Tacoma age 3 $37,647 (n=3246), age 5 $34,130 (n=2013).
  - Published values for the same models (KBB model pages, accessed 2026-11-03): 2021 Civic private-party $15,650, trade-in $12,000 (ratio 0.77); 2021 CR-V $19,550 / $17,050 (0.87); 2021 Tacoma trims $27,500–$31,400 / $24,100–$29,200 (about 0.88); 2023 Civic $19,650 / $16,850 (0.86); 2023 Tacoma $29,700 / $25,000 (0.84). Sources: https://www.kbb.com/honda/civic/2021/depreciation/, https://www.kbb.com/honda/cr-v/2021/depreciation/, https://www.kbb.com/toyota/tacoma-double-cab/2023/depreciation/
  - Edmunds appraisal for the 2021 Civic (clean condition) lists trade-in / private-party / dealer-retail of $18,004 / $20,794 / $23,484, so private-party sits about 11% below dealer retail (https://www.edmunds.com/honda/civic/2021/appraisal-value/).
  - The PRD defines resale as what a buyer would pay the owner, i.e. private-party, not trade-in. Private-party runs 11–15% below dealer retail in these sources, and trade-in a further 13–23% below private-party. A single 15% discount (factor 0.85) on the provider's retail medians approximates private-party resale without flattering walk-away costs. It sits inside the PRD's expected 10–20%.
- **P17 MPG: PASS with one gap.**
  - EPA combined MPG (2026 model year, fueleconomy.gov dataset, base gas powertrain; EPA vehicle id in `lowkey/preflight/p17_mpg.py` output): Accord Sedan 31, Civic Sedan 36, Civic Si Sedan 31, Mazda3 Sedan 30, Elantra 34, CR-V 29, Corolla Cross 30, CX-50 26, 4Runner 21, Bronco 20, Venue 31, Tacoma 21, Ram 1500 ("1500") 20.
  - **No EPA rating exists for the heavy-duty pickups** F-250, F-350 and Silverado 3500HD (heavy-duty trucks are exempt from EPA fuel-economy ratings; the dataset's last F250 rating is 1999). If a heavy-duty truck ever ranked, the PRD's fuel forecast could not price its fuel. None is a plausible consumer pick at $264–$323/mo depreciation, but the ranking code should expect a missing MPG.
- **P10, P15, P16: blocked, key missing.** `META_API_KEY` and `EIA_API_KEY` are empty in the environment, as the task states. Not run.

## What the data does to the PRD

- The hypothesis holds for SUV and Pickup (#1 CR-V, #1 Tacoma; Honda and Toyota take 4 of 6 top-2 slots across categories) but the Sedan #1 is the Accord, narrowly ahead of the Civic (0.772 vs 0.768 fitted 5-year retention) — inside any reasonable noise band, so Sedan effectively has co-leaders.
- Corolla, the expected commodity sedan, is not cheap to hold on the new basis ($151/mo, retention 0.68): its 2026 new price has risen against its used values. The Civic is both #2 and the commodity pick.
- Heavy-duty trucks occupy 3 of the Pickup top 5 by percentage retention while costing $264–$323/mo. Percentage retention alone promotes expensive trucks; the commodity pick (Tacoma on both measures) is the safeguard, and the PRD may want a price or class guard for #1/#2 as well.
- Rural coverage is real but thin: 0 Accord Sedans within 50 miles of 59001 (5 at 150), 4–6 units for the other two models. The "3 local units per car" promise is not guaranteed in rural ZIPs.

## 2026-11-03 (task 023, runner): lineups under the lineup rules

Recomputed from the task-022 fits (new-price basis) with the PRD lineup rules as pulled for this run: four ranked picks per category, no make holding more than 2 of the 4, heavy-duty pickups excluded, resale after the 15% trade-in discount (fitted retail retention × 0.85; dollars per month = new price × (1 − adjusted retention) / 60). A model ranks only with a fitted retention, a current new price and at least 30 sold units at each of at least 3 fitted ages. Makes were resolved per model from current new inventory (`lowkey/preflight/make_map.py`; bare "1500"/"2500"/"3500" are Ram). Logic: `lowkey/preflight/lineup.py`; full machine output cached outside git (`lineups.json`). Retention below is after the discount, with the retail fit in parentheses.

- **Sedan** (3 makes: Honda, Hyundai, Mazda):
  - #1 Honda Accord Sedan: retention 0.656 (fit 0.772), $180/mo, new $31,472; sold n by age 1–5: 1050, 1384, 780, 1374, 1262.
  - #2 Honda Civic Sedan: retention 0.653 (fit 0.768), $163/mo, new $28,180; sold n: 692, 1768, 1183, 1131, 697. Also the commodity pick (`badge`, cheapest to hold).
  - #3 Mazda Mazda3 Sedan: retention 0.623 (fit 0.733), $172/mo, new $27,387; sold n: 201, 185, 160, 125, 212.
  - #4 Hyundai Elantra: retention 0.599 (fit 0.705), $166/mo, new $24,860; sold n: 1479, 1306, 1740, 574, 810.
  - Skipped by the make cap: Honda Civic Si Sedan (fit 0.762) would have been the third Honda.
- **SUV** (3 makes: Honda, Mazda, Toyota):
  - #1 Honda CR-V: retention 0.629 (fit 0.741), $216/mo, new $34,899; sold n: 983, 2462, 826, 1136, 1330.
  - #2 Toyota Corolla Cross: retention 0.623 (fit 0.733), $206/mo, new $32,783; sold n ages 1–4: 292, 609, 675, 506 (no age-5 sales yet; the 5-year value is extrapolated).
  - #3 Mazda CX-50: retention 0.596 (fit 0.701), $241/mo, new $35,718; sold n ages 1–3: 714, 994, 536 (extrapolated to 5 years).
  - #4 Toyota 4Runner: retention 0.585 (fit 0.689), $404/mo, new $58,416; sold n: 916, 1066, 1538, 1053, 1078.
  - Commodity pick (`extra`): Hyundai Venue, retention 0.575 (fit 0.676), $176/mo, new $24,856; sold n ages 1–4: 389, 310, 424, 246.
- **Pickup** (3 makes: Chevrolet, Ram, Toyota):
  - #1 Toyota Tacoma: retention 0.633 (fit 0.745), $281/mo, new $46,039; sold n: 1897, 2155, 3246, 1849, 2013.
  - #2 Ram 1500 (provider model "1500"): retention 0.609 (fit 0.716), $364/mo, new $55,801; sold n: 2424, 181, 190, 2449, 2105. Ages 2–3 are much thinner than ages 1, 4 and 5; the fit uses all five ages, each still above 30.
  - #3 Chevrolet Colorado: retention 0.564 (fit 0.664), $310/mo, new $42,691; sold n: 803, 1795, 1387, 833, 623.
  - #4 Chevrolet Silverado 1500: retention 0.560 (fit 0.659), $378/mo, new $51,541; sold n: 2573, 5628, 5350, 2633, 4039.
  - Commodity pick (`extra`): Ford Maverick, retention 0.554 (fit 0.652), $264/mo, new $35,509; sold n ages 1–4: 670, 722, 365, 485.
  - Excluded as heavy-duty before ranking: Ram 2500 ("2500"), Chevrolet Silverado 2500HD, Ford F-250, GMC Sierra 2500HD, Chevrolet Silverado 3500HD, Ford F-350. (The task-022 percentage top 5 had three of these; none can appear now, and none has an EPA MPG rating.)
- Under task 023's superseded two-pick text (distinct makes), Sedan #2 would instead be the Mazda3 Sedan with the Civic demoted to commodity-`extra`; the SUV and Pickup #1–#2 are unchanged. The four-pick lineups above follow the PRD as pulled (`lowkey/docs/prd.md`, amended by task 024).
- **P10 Muse Spark tool use: PASS (after one prompt fix).** Script: `lowkey/preflight/p10_spark_tools.py` (`muse-spark-1.3`, `max_tokens` 4000, no reasoning-effort parameter; at 1600 the hidden reasoning took 1598 of 1600 completion tokens and the reply was empty). Tools `rank_category`, `ownership_math`, `local_units` are backed by fixed fixtures; the number check is automatic (every number in a reply must appear in a tool result). Baseline system prompt: right tools in 9 of 10 prompts ("Show me sedans near 60614" skipped the ranking), numbers 10 of 10, 40,166 tokens (18,558 reasoning). One change — the system prompt now states that any category mention is a ranking request and a ZIP never replaces it — then: right tools in 10 of 10, numbers 10 of 10, 46,686 tokens (23,117 reasoning). Extra `rank_category` calls accompanied three payment questions; every required tool was still called. Latency was 18–34 s per prompt (two API rounds), above the PRD's 15-second first-cards target.
- **P16 Gas forecast: PASS (pooled), with a per-series caveat.** Script: `lowkey/preflight/p16_forecast.py` (Timestral-28M on CPU in `~/.cache/low-key/venv-timestral/`; code Apache-2.0, weights Modified MIT — see the licence note in the script: no rights above $20M global monthly revenue, attribution required, check before production use per AGENTS.md). Backtest over all 29 part-3 series, 5 origins each, 52 weeks ahead (7,540 series-weeks): the 10th–90th range covered the actual price 77.0% of the time (bar: 70%), and the median's mean absolute error was $0.396/gal against $0.418/gal for "the price stays the same". Coverage cleared 70% in all 29 series; the median beat the flat forecast in 17 of 29 series pooled-weighted to a win, but lost in the East Coast series (all three PADD 1 sub-districts, Florida, Massachusetts, New York state and city, Boston, Miami) over these recent origins — including PADD 1C, the series ZIP 30097 maps to (MAE $0.337 vs $0.304 flat). The two series the other test ZIPs map to pass both legs (Chicago: coverage 84%, MAE $0.409 vs $0.482; PADD 4: 80%, $0.388 vs $0.428). Product implication: show the Timestral range everywhere, but expect no median edge over today's price on the East Coast.
- **P15 Gas price data: PASS.** Script: `lowkey/preflight/p15_gas.py` (EIA API v2, weekly, product EPMR; raw series cached outside git). All 29 area series were pulled; the shortest history is 23.4 years (weekly throughout). EIA covers 9 states directly (CA, CO, FL, MA, MN, NY, OH, TX, WA) and 10 cities (Boston, Chicago, Cleveland, Denver, Houston, Los Angeles, Miami, New York City, San Francisco, Seattle), plus the US, the five PADDs, the three PADD 1 sub-districts and PADD 5 except California. ZIP → most-local series (city, then state, then sub-PADD/PADD, then US): 60614 → Chicago city (26.4y), 30097 → PADD 1C (33.6y; Georgia has no state or city series), 59001 → PADD 4 (34.5y). Each test ZIP clears the 10-year bar by more than 2x.

## 2026-11-03 (task 024, runner): four-pick confirmation and P8 spot-check of #3/#4

- **Parts 1–2 confirmed, no change.** `lowkey/preflight/lineup.py` already implements the four-pick rule (`top_k=4, max_per_make=2`, 15% discount, heavy-duty exclusion, ≥30 sold units at each of ≥3 fitted ages, `badge`/`extra` commodity flag) and `lowkey/preflight/test_lineup.py` already covers the third same-make skip, commodity `badge` and `extra`, and a category with fewer than 4 qualifying models. Fixture tests: 9 passed. Recomputing from the cached task-022 fits reproduces the task-023 four-pick lineups above exactly (Sedan 3 makes, SUV 3 makes, Pickup 3 makes; no category short of 4), so they stand as the four-pick lineups.
- **P8 spot-check (ZIP 60614, 50 miles, new in stock, cheapest first, strict gas filter; script `lowkey/preflight/p8_four_picks.py`, summary cached outside git):**
  - Sedan #3 Mazda Mazda3 Sedan: 127 units, lowest $24,470.
  - Sedan #4 Hyundai Elantra: 309 units, lowest $19,799.
  - SUV #3 Mazda CX-50: 391 units, lowest $30,159.
  - SUV #4 Toyota 4Runner: 30 units, lowest $44,091.
  - Pickup #3 Chevrolet Colorado: 332 units, lowest $33,746.
  - Pickup #4 Chevrolet Silverado 1500: 912 units, lowest $37,812.
  - Lowest price is the cheapest unit's selected price (equal to its price with fees in all six cases). Every #3/#4 pick has at least 30 units within 50 miles, so no widening was needed. Listings spend for these six searches: usage 125 requests / 455,000 charged micros before, 130 / 465,000 after (+5 requests, +$0.010 of the $0.25 cap).
