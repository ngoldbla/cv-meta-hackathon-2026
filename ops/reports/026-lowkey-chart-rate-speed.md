# Report 026: Low Key: worth-vs-owe chart, Federal Reserve loan rate, code-written summary, faster first cards
Status: in_progress
Branch head at start: 899f20bbcb591ee074d1ea428afe362caf9ba88c  ·  at finish: (this commit)

## Summary
In progress.

## Work done
- Stayed on branch `low-key` throughout (fetched and pulled `origin/low-key`; head 899f20b at start). The inbox skill's `git checkout main` step was not followed, per this task's "Branch: `low-key` only" and the session instruction to work only on `low-key` — the same approved deviation as tasks 022–025.
- Claimed this task (commit `Start task 026`): set `ops/tasks/026-lowkey-chart-rate-speed.md` to `in_progress` and created this report.
- Parts 1–4 + chart (this commit): `ownership_math` curve/evenMonth/table, FRED rate, code-written summary, full + mini charts. `npm ci && npm run build` and app tests pass before the push (see Results).

## Results
- **`ownership_math` (part 1):** added `curve` (61 points, months 0–60, `{month, resale, balance}` from `resaleAt`/`balanceAt`), `monthly` (per-month walk-away detail for the slider), `evenMonth` (first month resale ≥ balance; `underwaterMonth` kept as alias) and walk-away entries `{month, getBack, costPerMonth}` (`getBack` = resale − balance, `costPerMonth` = walk-away cost ÷ month; `walkAwayCost`/`perMonth`/`equity` kept alongside). Sample check ($33,000, 10% down, 8.0% APR, 60 months, retention 0.629): `evenMonth` 7, `getBack` at 36 $10,099 (task ≈ $10,118, within $35), `costPerMonth` at 60 $311. App tests after parts 1–4: **43 passed** (was 18).
- **FRED (part 3, code):** `lib/fred.ts` parses `RIFLPBCIANM60NM` CSV (blank/dot rows skipped), server fetch with `revalidate: 86400`, fallback 8.0% labelled "assumed". Live CSV check: latest non-empty **2026-08-01 = 7.54%**. Label: "7.54% APR: the national average for 60-month new-car loans (Federal Reserve, Aug 2026)". `GET /api/apr` exposes it; the footer and walk-away view show it. "My rate is 5.9%" parsing covered by tests.
- **Summary (part 4, code):** `lib/summary.ts` builds each card sentence and the closing line from tool results only (template + unit tests against fixtures).
- **Chart (part 2, code):** hand-written SVG in `components/WorthChart.tsx` (gold `#7A5A10` solid worth, ink `#1B1C1E` dashed owe, warm underwater fill, green yours fill, crossing dot), full view `components/WalkAwayView.tsx` with native range slider (months 1–60, default 36), dark two-sentence box and three-column table matching the mockup; mini chart on every card labelled "Underwater for N months".

## Deviations
- Inbox sync step not followed (see above); synced `origin/low-key` instead.

## Blocked / questions
- None yet.
