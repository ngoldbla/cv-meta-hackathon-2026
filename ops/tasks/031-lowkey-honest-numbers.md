---
id: "031"
title: "Low Key: one resale basis, model years shown, unrated lifespans, real trim steps"
status: open
created: 2026-11-03
report: ops/reports/031-lowkey-honest-numbers.md
---
# Low Key: four fixes from the 027–029 questions

**Run this after task 030 is done.** **Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. Provider cap $0.50 (a table rebuild plus deployed checks); Muse Spark cap $0.25.

These answer the questions at the end of reports 027 and 029. Dylan approved all four on 2026-11-03.

## Parts
1. **One resale percentage: after the discount, everywhere.**
   - Today the CR-V card says "keeps 63%" in its sentence (after the 15% discount) and "the model's 74%" in its trim line (retail). Every percentage the user sees must be the **after-discount** figure, because the dollar figures (get back, cost to drive) are computed from it.
   - Change `trimLineText` in `lib/costs.ts` (and anything else that shows retail retention) to after-discount values: retail × 0.85, using the table's factor rather than a hard-coded 0.85. The CR-V line becomes "the EX keeps 58% … below the model's 63%".
   - The guard's 3-point threshold stays on the **retail** fits (the decision itself doesn't change); only the displayed numbers change. Say so in a code comment.
   - Word the sentence so the meaning is plain: "keeps about 63% of its price: what you'd likely get selling it after 5 years." Keep "the most of any gas SUV here" when it applies. Update the comment examples in `lib/summary.ts` (one still says 74%).
   - Grep the app and the PRD for any other user-visible retail percentage, and fix it. Add a test that no user-facing string from the summary or trim line contains the retail percentage for a fixture whose retail and after-discount values differ.
2. **Model year: keep every new unit, and show the year.**
   - Local search keeps all model years of new units (no year filter).
   - Every unit on the card shows its year next to the trim, for example "2027 Civic Sport".
   - If a unit's model year is **earlier** than the current model year in the table (a leftover), add one line: "2025 model year: at resale it counts as a year older." If it is later, no note.
   - Tests with fixtures: same year (no note), earlier year (note), later year (no note), year missing (no year shown, no note).
3. **Unrated lifespan: show the row, say "not yet rated".**
   - When a model has no lifespan figure, the Lifespan row still appears and says "Not yet rated", with no number and no fallback estimate, so every card has the same rows in the same order.
   - The sentence leaves out the "Built to last…" clause for those models (as now).
   - Test: a fixture with no lifespan renders the "Not yet rated" text, and nothing derived from a lifespan (cost per year of life) appears in the walk-away view.
4. **Cosmetic variants are not a trim step.**
   - In `lowkey/pipeline/trim.py`, before ordering trims by MSRP, merge variants that differ only in appearance into their base trim, keeping that trim's cheapest variant's MSRP. Cosmetic markers include "2-Tone", "Two-Tone", "Two Tone", "w/ … Roof", "Roof", "Paint", "Color", "Appearance", "Black Edition"/"Nightshade"-style packages and similar. List the exact rule (patterns) in a docstring, and log every merge the build makes.
   - Expected: Venue SE → **SEL** (not "SEL w/ 2-Tone Roof"). Check every other model's step after the change and report any that moved.
   - Don't merge variants that change the engine, drivetrain, cab, bed or seats (for example "AWD", "4WD", "Crew Cab", "Hybrid", "Turbo"): those are real differences.
   - Fixture tests: the Venue list steps to SEL; a list where the only higher variant is cosmetic falls back to the next real trim; a drivetrain variant is not merged.
   - Rebuild and re-upload the table (task 027's commands; no `--refresh-*` unless specs need it).

5. **The car drawing is too big on the card** (reviewer, from `~/.cache/low-key/screens/030/03-cards-after-one-tap.png`). At 390 px the Hairline figure sits in roughly 400 px of empty space, pushing the numbers below the fold, and the "In stock" dot crowds the sentence. Put the figure in a small fixed box (about 96 px tall) beside or above the model name, with the rank badge and "In stock" on one row, so the monthly bills are visible without scrolling on a 390×844 screen. Keep the figure's own size rules from task 028 and the reduced-motion rule.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `pytest lowkey/`, `ruff check lowkey/`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px: Sedan near 60614 and SUV near 60614. Confirm the CR-V card shows only after-discount percentages, the Corolla Cross and CX-50 cards show "Not yet rated", the Venue recommends the SEL, and every unit shows its model year. Note any leftover-year line that appears.
- Screenshots under `~/.cache/low-key/screens/031/` (not in git).

## Stop and report
In `ops/reports/031-lowkey-honest-numbers.md`: every percentage string you changed (before → after), the trim merges the build logged and any recommended trim that moved, the leftover-year notes seen live, the screenshot paths, the live commit, spend, and questions for Dylan.
