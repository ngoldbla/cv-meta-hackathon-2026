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

## Results
—

## Deviations
- Inbox skill step 1 says `git checkout main`; followed the task's `low-key` only rule instead (same deviation as tasks 022/023, approved there). Work stays on `low-key`.

## Blocked / questions
—
