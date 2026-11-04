# Report 039: Low Key: show equity as one rising line — "Positive equity by month X"
Status: done
Branch head at start: bd5df63de2fd70c1460f596ec8805db586649d19  ·  at finish: —

## Summary
Done. Every card and the walk-away view now show equity as one rising line with a zero line: "Positive equity by month 14" and "$20,113 yours at 5 years" for the CR-V near 60614 (14 months since task 037 financed the tax). "Underwater" is gone from the UI, the templates, the tool description and the system prompt. Muse ran out of Meta API credit (HTTP 402 billing error) partway through part 2; the reviewer finished parts 2–5 directly on dylan-pc, starting from Muse's uncommitted work.

## Work done
- Claimed task 039 on branch `low-key` (head `bd5df63`, claim `c98dc9c`). Inbox sync on `main` not followed per the task's `low-key`-only rule and the run instruction to work only on `low-key` — same approved deviation as tasks 022–038; work stays on `low-key` only.
- Part 1 (data): `ownershipMath` now adds `equity = resale − balance` to every curve point and returns `positiveEquityMonth` as the primary month, with `evenMonth`/`underwaterMonth` kept as aliases. The spec builder carries `equity` on every curve point (deriving it for old outputs), the catalog schema requires it, and the number guard checks every equity point exactly plus the `equity = resale − balance` identity. New summary templates (`positiveEquityLabel`, `equityHeadline`, `yoursAt5YearsLabel`, `sellLine`) added with the legacy label kept as an alias. App tests 155 passed at this step.

- Parts 2–5 (reviewer, after Muse stopped): `EquityMini` replaces `UnderwaterMini` in the catalog, registry, spec builder (`<slug>-equity`) and guard (the guard accepts both type names so cached old specs still verify). The card chart draws one line, a green area above zero, a muted band below and a dot at the crossing; the in-chart label was dropped at that size because it sat on the line. `FullChart` in the walk-away view is now the same single equity line with dollar axis labels (−$5k … $25k), the crossing marked "month N", the slider marker and its value. The walk-away headline is `equityHeadline` ("Positive equity by month 14."), the two-line legend is gone, the sentence reads "About $8,600 is yours after you sell and pay off the loan" (or "You'd owe about $X to sell this early"), and the table column is "Your equity". The system prompt now describes positive equity, never "underwater", and asks for a calm tone; the `ownership_math` tool description names `positiveEquityMonth`; the text fallback uses `positiveEquityLabel`.
- Wording changes (grep of "underwater", "Underwater", "above water", "worth-vs-owe" in `lowkey/app`): `WalkAwayView` headline (4 variants → `equityHeadline`), `TextFallback` label, `WorthChart` aria-labels and the in-chart "underwater" text (removed), `route.ts` system prompt, `tools.ts` description, `catalog.ts` and `PickCardView.tsx` comments. Remaining hits are the legacy `underwaterMonth` alias field and `underwaterLabel` alias (both kept until callers move).

## Results
- Tests: app tests **158 passed** (new: EquityMini on every card with the right month and `equity = resale − balance`; the guard rejects a tampered month; month-60 equity equals resale), `npm run build` clean, `pytest -q` 154 passed / 1 skipped, `name_guard` and `secret_guard --all` clean.
- Local production build at 390 px, light and dark (`~/.cache/low-key/screens/039/` and `039b/`, not in git): card `03-card.png`, walk-away `04-walk.png`. No console errors.
- Live: see the finish commit; checked on the deployed URL after the push.

## Deviations
- Inbox step 1 (`git checkout main && git pull`) not followed: the task and the run instruction both require branch `low-key` only. Synced with `git fetch` + `git pull --ff-only` on `low-key` instead (already up to date at claim).

## Blocked / questions
Nothing blocked. Muse Code and the live follow-up chat both fail with Meta API HTTP 402 (billing) until Dylan resolves billing; the fast path (cards) is unaffected.
