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
