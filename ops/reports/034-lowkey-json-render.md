# Report 034: Low Key: draw the numbers with json-render (cost bars, comparison, lifespan track)
Status: in_progress
Branch head at start: 141a773187305bc7b0a732041419ca41bf8b7bd8  ·  at finish: —

## Summary
In progress. Claimed on branch `low-key` (inbox skill's `git checkout main` step skipped per task 023/034 branch rule: `low-key` only).

## Work done
- Claimed task 034: set `status: in_progress`, created this report.
- Read the json-render docs (json-render.dev introduction, catalog, registry, specs, installation) and the approved mockups before using the packages.
- Part 1 (setup): pinned `@json-render/core` and `@json-render/react` at 0.21.4 (exact, lockfile committed); `zod` 4.6.7 was already pinned. Catalog in `lowkey/app/lib/render/catalog.ts`, React registry in `lowkey/app/components/render/registry.tsx`.
- Part 2 (catalog components): `CostCompare`, `CostBars`, `LifespanTrack`, `UnderwaterMini`, `DealerLine`, `PickCard` in `lowkey/app/components/render/`, built on the installed Iconiq `Card`/`Badge`/`StatusDot`/`b-collapsible` and the task-026 `MiniChart`, with mockup colours through new `--cost-*` theme tokens (light hexes from the mockup, dark values alongside).
- Part 5 code (guard): `lowkey/app/lib/render/specs.ts` (pure builders) and `lowkey/app/lib/render/guard.ts` (walks a spec, checks every number against the tool outputs). Tests in `lowkey/app/lib/render/specs.test.ts`: 11 passed over fixtures for all three categories, including the CR-V back-to-you hand check and tamper/unchecked-number failures.
- Part 3 (wiring): the fast path builds each card spec on the server right after its tool results and streams it as a `data-lowkey-spec` part (plus one compare part per turn), each passing the number guard server-side first. The page renders only from specs: server specs when present, otherwise the same pure builders over the streamed tool-result parts (the model path). Every spec is catalog-validated (Zod) and number-guarded on the page before rendering; a failure drops the spec, logs one fixed line without data, and the card falls back to `TextFallback` text. The old hand-built `PickCard` number rows are removed (`components/PickCard.tsx` deleted).
- Part 4 (walk-away): left unchanged, deliberately. The walk-away view's data carries no fuel estimate, so a "You pay vs really costs" bar there would omit gas and disagree with the card bars; the view already shows cost per month at the slider month and the get-back figure, the same comparison in numbers. The bars are a 5-year-hold framing ("back when sold at 5 years") that does not transfer to an arbitrary sell month.
- Part 6 (accessibility): every chart section carries an `aria-label` that reads its numbers (CostBars and CostCompare read every segment, LifespanTrack reads the years, UnderwaterMini the underwater label); legends carry the dollar values and row totals, so nothing is colour-alone. Bars render at final width with no growth animation, so reduced motion needs nothing extra (the app's `MotionConfig reducedMotion="user"` still governs the rest).
- Part 7b (location lookup): per-attempt fetch timeout is now 5 s (`GEO_FETCH_TIMEOUT_MS`, was 12 s) and the page shows "Still looking…" after 3 s (`STILL_LOOKING_AFTER_MS`), then the existing failure message if it still fails. Geo tests cover both numbers.

## Results
—

## Deviations
- Inbox skill step 1 says `git checkout main`; followed the task's `low-key` only rule instead (same deviation as tasks 022/023, approved there). Work stays on `low-key`.

## Blocked / questions
—
