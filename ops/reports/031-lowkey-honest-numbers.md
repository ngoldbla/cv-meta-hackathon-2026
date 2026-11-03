# Report 031: Low Key: one resale basis, model years shown, unrated lifespans, real trim steps
Status: in_progress
Branch head at start: fdb7ae1ca5b3b8e1bcd5a10c8eca4ebdcefeab43  ·  at finish: pending

## Summary
Pending.

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

## Deviations
- Inbox skill says sync on `main`; the direct instruction for this run is branch `low-key` only, so all work is on `low-key`.

## Blocked / questions
Pending.
