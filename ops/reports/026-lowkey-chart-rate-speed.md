# Report 026: Low Key: worth-vs-owe chart, Federal Reserve loan rate, code-written summary, faster first cards
Status: in_progress
Branch head at start: 899f20bbcb591ee074d1ea428afe362caf9ba88c  ·  at finish: (this commit)

## Summary
In progress.

## Work done
- Stayed on branch `low-key` throughout (fetched and pulled `origin/low-key`; head 899f20b at start). The inbox skill's `git checkout main` step was not followed, per this task's "Branch: `low-key` only" and the session instruction to work only on `low-key` — the same approved deviation as tasks 022–025.
- Claimed this task (commit `Start task 026`): set `ops/tasks/026-lowkey-chart-rate-speed.md` to `in_progress` and created this report.
- Parts 1–4 + chart (commit a06c8a5): `ownership_math` curve/evenMonth/table, FRED rate, code-written summary, full + mini charts. `npm ci && npm run build` and app tests pass before the push (see Results).
- Part 5 (this commit): reasoning-effort probe, `reasoning: "minimal"` on the model path, and the ZIP+category fast path. Timings below; deployed "after" runs follow the push.

## Results
- **`ownership_math` (part 1):** added `curve` (61 points, months 0–60, `{month, resale, balance}` from `resaleAt`/`balanceAt`), `monthly` (per-month walk-away detail for the slider), `evenMonth` (first month resale ≥ balance; `underwaterMonth` kept as alias) and walk-away entries `{month, getBack, costPerMonth}` (`getBack` = resale − balance, `costPerMonth` = walk-away cost ÷ month; `walkAwayCost`/`perMonth`/`equity` kept alongside). Sample check ($33,000, 10% down, 8.0% APR, 60 months, retention 0.629): `evenMonth` 7, `getBack` at 36 $10,099 (task ≈ $10,118, within $35), `costPerMonth` at 60 $311. App tests after parts 1–4: **43 passed** (was 18).
- **FRED (part 3, code):** `lib/fred.ts` parses `RIFLPBCIANM60NM` CSV (blank/dot rows skipped), server fetch with `revalidate: 86400`, fallback 8.0% labelled "assumed". Live CSV check: latest non-empty **2026-08-01 = 7.54%**. Label: "7.54% APR: the national average for 60-month new-car loans (Federal Reserve, Aug 2026)". `GET /api/apr` exposes it; the footer and walk-away view show it. "My rate is 5.9%" parsing covered by tests.
- **Summary (part 4, code):** `lib/summary.ts` builds each card sentence and the closing line from tool results only (template + unit tests against fixtures).
- **Chart (part 2, code):** hand-written SVG in `components/WorthChart.tsx` (gold `#7A5A10` solid worth, ink `#1B1C1E` dashed owe, warm underwater fill, green yours fill, crossing dot), full view `components/WalkAwayView.tsx` with native range slider (months 1–60, default 36), dark two-sentence box and three-column table matching the mockup; mini chart on every card labelled "Underwater for N months".
- **Speed (part 5):** lower reasoning effort **is** supported. Probe of `muse-spark-1.3` (tiny "OK" prompt): `reasoning_effort: "none"` is rejected (supported: minimal, low, medium, high, xhigh, max); `minimal` cut reasoning to 5–74 tokens / 0.6–0.9 s vs baseline 158–188 tokens / 1.7–1.9 s (`low` ≈ baseline). On a stub-tool "60614, SUV" turn: default 14.31 s total (1,901 reasoning tokens) vs `minimal` 5.46 s (339 reasoning), tools correct both times. The model path now sends `reasoning: "minimal"`, but the fast path was still added because the deployed model path measured over target (below), so **the fast path was needed**: a first message with ZIP + category calls `rank_category`, `ownership_math` and `local_units` directly in parallel and streams tool-result parts with the code-written summary; follow-ups still use the model (verified: "$5k down on the CR-V" → `ownership_math` at 7.54% in 9.9 s local).
- **Timings for "60614, SUV"** (server stream: first `ownership_math` output = first card; stream end = full answer; 3 runs each). Before (model path): local first card 12.29 / 12.63 / 23.11 s, full 39.33 / 37.01 / 48.01 s; deployed first card 22.60 / 20.44 / 16.19 s, full 54.46 / 59.89 / 49.42 s. After (fast path): local first card = full **0.09 / 0.02 / 0.01 s** (FRED cache warm). Deployed after: pending post-push measurement.

## Deviations
- Inbox sync step not followed (see above); synced `origin/low-key` instead.

## Blocked / questions
- None yet.
