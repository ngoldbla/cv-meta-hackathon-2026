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

## Deviations
- Inbox skill says sync on `main`; the direct instruction for this run is branch `low-key` only, so all work is on `low-key`.

## Blocked / questions
Pending.
