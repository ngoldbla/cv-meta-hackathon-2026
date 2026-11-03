---
id: "040"
title: "Low Key: no rank numbers — a sortable chooser, best-at labels, full cards in a sheet"
status: open
created: 2026-11-03
report: ops/reports/040-lowkey-chooser.md
---
# Low Key: the chooser

**Run this after task 039 is done.** **Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. Provider cap $0.05; Muse Spark cap $0.05.

**Why (Dylan, 2026-11-03):** a vertical scroll of cards implies a strong ranking preference, which Low Key doesn't have. Every car shown is one we stand behind; the order should be the user's choice. Dylan approved the reviewer's option (b).

## Parts
1. **The comparison block becomes the chooser.**
   - One compact row per car: the name and trim, its best-at labels (part 2), the real-cost bar and total, and the monthly bills.
   - Above the rows, a **"Sort by"** control (Iconiq `tabs` or `toggle-group`): **Real cost · Monthly · Nearest · Lasts longest**. The default is **Real cost**.
     - Unrated lifespans sort last under "Lasts longest".
     - Cars with no local unit sort last under "Nearest".
   - Re-sorting animates gently, and not at all under reduced motion. The bars keep a shared scale.
   - Remember the chosen sort for the session.
2. **No rank numbers.** Remove "Pick #1…#4" badges and ordinal language in the UI and templates ("the most of any gas SUV here" may stay, since it's a fact). Each car gets **best-at labels** computed in code from the tool results, any that apply:
   - "Holds value best" (highest after-discount retention);
   - "Cheapest to own" (lowest real cost);
   - "Lowest monthly" (lowest bills);
   - "Nearest" (closest unit);
   - "Lasts longest" (longest rated lifespan).
   Ties give the label to both. The commodity pick's "extra" badge becomes just its labels. Keep the Toyota+Honda lineup rule (it decides who is shown, not the order).
3. **Tap a row → the full card in a sheet.** Iconiq `drawer` on phones and a `dialog` or side panel on wide screens: the full card (CostBars, the lifespan track, the equity chart, the dealer line, "If I change my mind"). Swiping between cars inside the sheet follows the current sort order. Closing it returns to the same scroll position.
4. **The model's text** must not call any car "#1" or "top pick". Update the system prompt.
5. **Tests:**
   - the four sort orders over fixtures, including the unrated and no-unit cases;
   - label assignment and ties;
   - no "Pick #" string in any spec or template.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px, in light and dark: SUV near 60614, cycle through the four sorts, open two cars in the sheet, and swipe between them. Screenshots under `~/.cache/low-key/screens/040/` (not in git). Record the time to the first row.

## Stop and report
In `ops/reports/040-lowkey-chooser.md`: the labels each car got, the screenshots, the timing, the live commit, and questions for Dylan.
