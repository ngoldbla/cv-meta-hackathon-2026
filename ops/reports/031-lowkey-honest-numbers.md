# Report 031: Low Key: one resale basis, model years shown, unrated lifespans, real trim steps
Status: done
Branch head at start: fdb7ae1ca5b3b8e1bcd5a10c8eca4ebdcefeab43  ·  at finish: (this commit)

## Summary
Done. Every percentage the user sees is now the after-discount figure (the CR-V trim line reads "the EX keeps 58% … below the model's 63%"), every listed unit shows its model year with a leftover-year note where one applies (seen live on a 2025 Venue), unrated models show a "Not yet rated" lifespan row (Corolla Cross, CX-50, Venue), cosmetic variants no longer count as a trim step (Venue now recommends the SEL), and the card figure sits in a 96 px box beside the title with the badge and "In stock" on one row. All checks pass; provider spend $0.010 of the $0.50 cap; Muse Spark $0.

## Work done
- Claimed: set task status `in_progress`, created this report (commit at start `fdb7ae1` on `low-key`).
- Part 1 (after-discount percentages):
  - `lowkey/app/lib/costs.ts`: `trimLineText` now displays after-discount percentages (retail fit × `tradeInFactor`, default `TRADE_IN_FACTOR` from `lib/ownership.ts`); comment states the guard decision stays on the retail fits in `trim.py` and only the shown numbers change.
  - `lowkey/app/lib/summary.ts`: `cardSentence`/`closingLine` now say "keeps about N% of its price: what you'd likely get selling it after 5 years" (superlative kept); the stale 74% comment example now shows 58%.
  - `lowkey/app/lib/table.ts`: `lineupFromTable` attaches `tradeInFactor: table.tradeInFactor` to picks and the commodity; `PickCard.tsx`/`HomeClient.tsx` plumb it through.
  - Tests: costs CR-V fixture (retail 0.688/0.741 → shown 58%/63%, no 69%/74%), updated guard test (0.60/0.68 → 51%/58%), summary no-retail test (retail 74% vs after 63%); sentence-wording expectations updated to the new plain wording. Focused run: 22 passed.

## Results
- Percentage strings changed (before → after): CR-V trim line "the EX keeps 69% … model's 74%" → "the EX keeps 58% … model's 63%"; card sentence "Keeps 63% of its price after 5 years" → "Keeps about 63% of its price: what you'd likely get selling it after 5 years"; closing line same wording change; `lib/summary.ts` comment example 74% → 58%.
- PRD grep (`lowkey/docs/prd.md`): no user-visible retail percentage found (only the 15% trade-in discount method note) — nothing to fix there.
- Part 2 (model years):
  - Search already sent no year filter; documented in `lowkey/app/lib/listings.ts` and pinned by a test (URL has no `year=`; mixed 2025/2026/2027 rows all kept; missing year kept as `null`).
  - `lowkey/app/lib/table.ts` attaches `currentYear` (the table's EPA model year) to picks/commodity; `HomeClient.tsx` types it.
  - `PickCard.tsx` now lists every unit (up to 3) under "Distance to the dealer" as "2027 Civic Sport · $price · N mi · Dealer · See the car" (`unitTitle` in `lib/costs.ts`), with one leftover note per older year via `leftoverYearNote` ("2025 model year: at resale it counts as a year older."). Fixture tests cover same/earlier/later/missing year.
  - The `lifespanRowText` helper (part 3) also landed in `lib/costs.ts` in this commit; its card wiring follows in part 3. Focused tests 42 passed; `npm run build` passes.
- Part 3 (unrated lifespan): `PickCard.tsx` now always renders the Lifespan row via `lifespanRowText` — rated models keep "Lasts about N years", unrated show "Not yet rated" with no number, so every card keeps the same rows in the same order. The lifespan footnote still shows only for rated models; `cardSentence` already omits the "Built to last…" clause when unrated; `WalkAwayView` already guards its cost-per-year line on `pick.lifespanYears`. Tests: `lifespanRowText(null)` is "Not yet rated" with no digit (no DOM harness in the app, per report 028, so the row text is tested at the logic level). Focused tests 27 passed; build passes.
- Part 4 (cosmetic trim merge): `lowkey/pipeline/trim.py` gained `COSMETIC_MARKERS`/`REAL_MARKERS`, `cosmetic_base_name` and `merge_cosmetic_variants` (exact patterns in the module comment); `choose_trim` merges before ordering, and `build_table.py` logs every merge. Fixture tests (11 passed): Venue list steps SE → SEL at the cheapest variant MSRP; [LE, LE Black Edition, SE] steps to SE; [LX, LX AWD, EX] keeps "LX AWD" unmerged. Rebuilt the table with the task-027 commands (no `--refresh-*`; usage delta 0 requests, $0.00) and re-uploaded `lowkey/table.json` (91,513 bytes).
  - Merges the build logged: only `Venue: 'SEL w/ 2-Tone Roof' -> 'SEL' (kept MSRP 22600.0)`.
  - Recommended trims in the new table: Sedan Accord LX→SE, Civic LX→Sport, Mazda3 2.5 S→2.5 S Select Sport, Corolla LE→SE; SUV CR-V LX (guard), Corolla Cross L→LE, CX-50 2.5 S Select→2.5 S Preferred, 4Runner SR5→TRD Sport, Venue SE→**SEL**; Pickup Tacoma SR→SR5, Ram Tradesman→Express, Colorado WT (guard), Silverado WT→Custom, Maverick XL→XLT. Against report 029, only the Venue step moved (SEL w/ 2-Tone Roof → SEL); no other model's step changed.
- Part 5 (card figure): `PickCard.tsx` header now puts the rank badge and "In stock" on one row, and the Hairline figure in a fixed `h-24 w-[120px]` (96 px tall, keeping the figure's own 5:4 aspect) box beside the model name and sentence; the old centered 176 px figure block in the card body is gone. `CarFigure` is unchanged (package figure format, never `play`; reduced motion still via the core + `MotionConfig`). App tests 102 passed; build passes.
- Final checks (live commit `79dcb9c`): `npm ci && npm run build` passes; app tests **102 passed**; `pytest -q` **154 passed, 1 skipped**; `pytest lowkey/` **28 passed**; `ruff check lowkey/`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` clean.
- Deployed checks (https://low-key-murex.vercel.app, headless Chrome, 390×844, fresh profiles; area changed to Chicago, IL 60614):
  - Sedan near 60614 (4.36 s to cards): Accord/Civic/Mazda3/Corolla sentences in the new plain wording; every unit title year-first ("2026 Accord Sedan SE", "2027 Corolla SE"); no leftover note (all units 2026–2027 against the table's 2026 current year).
  - SUV near 60614: CR-V sentence "The LX keeps about 63% … the most of any gas SUV here." and trim line "LX (base): the EX keeps 58% of its price after 5 years, more than 3 points below the model's 63%, so the base trim is recommended." — no 74%/69% anywhere on the page. Corolla Cross, CX-50 and Venue lifespan rows all read "Not yet rated". Venue: "The SEL is one step up from base" and "SEL: +$2,050 over SE". Every unit on every card shows its year.
  - Leftover-year note seen live (one): on the Venue card, for the 2025 unit at Gregory Hyundai — "2025 model year: at resale it counts as a year older."
  - Layout: measured figure box 120×96 px; the first card's "Monthly bills" label sat at viewport y≈386 (visible without scrolling). Pick #1 and "In stock" render on one row (screenshot `03-suv-60614.png`).
  - Screenshots (390 px, not in git): `~/.cache/low-key/screens/031/01-opening.png`, `02-sedan-60614.png`, `03-suv-60614.png`, `04-suv-cards-60614.png`.
- Spend: table rebuild usage delta 0 requests / $0.00; provider `/usage` moved 293 requests / $1.091 (at the build) to 298 / $1.101 after the deployed checks — **$0.010 of the $0.50 cap**; Muse Spark **$0 of the $0.25 cap** (fast path only).

## Deviations
- Inbox skill says sync on `main`; the direct instruction for this run is branch `low-key` only, so all work is on `low-key`.
- The `lifespanRowText` helper landed in the part-2 commit (it shares `lib/costs.ts` with the year helpers); its card wiring is the part-3 commit, as noted in Work done.
- The "Not yet rated" and leftover-note behaviors are tested at the logic level (`lifespanRowText`, `leftoverYearNote`, `unitTitle` fixtures): the app has no DOM test harness (report 028), so no component-render test was added; both behaviors were confirmed on the deployed page instead.

## Blocked / questions
- Nothing blocked. For Dylan: (1) The Venue's merged SEL keeps the cheapest variant's MSRP ($22,600, the former 2-Tone variant's price), so its step cost stays +$2,050 — confirm pricing the step off a variant that no longer appears by name. (2) The card now lists up to three units under "Distance to the dealer" (needed to show every unit's year); say if you want the distance row back to the single cheapest unit with years shown elsewhere.
