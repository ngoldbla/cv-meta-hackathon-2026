---
id: "039"
title: "Low Key: show equity as one rising line — \"Positive equity by month X\""
status: done
created: 2026-11-03
report: ops/reports/039-lowkey-equity-chart.md
---
# Low Key: the equity chart

**Run this after task 038 is done.** **Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. Provider cap $0.05; Muse Spark cap $0.05.

**Why (Dylan, 2026-11-03):** "Invert and rephrase the underwater chart so it's clear that we have a positive, not a negative. Instead of 'no longer underwater', phrase it as 'reach positive equity by month X'. The chart should be inverted to show the positive benefit."

## Parts
1. **Data.** `ownership_math` adds `equity` to each curve point: equity = resale − balance (negative while the owner owes more than the car would sell for). Rename `evenMonth` to `positiveEquityMonth`, keeping an alias until every caller and test moves. The number guard checks the equity points.
2. **The small chart on the card (`UnderwaterMini` becomes `EquityMini`):**
   - one line, months 0–60, with a zero line;
   - the area above zero filled with the "yours" green token and labelled "Your equity";
   - the short stretch below zero as a thin muted band, not a warning colour;
   - a dot where the line crosses zero.
   Text: "**Positive equity by month 7**", with "$20,113 yours at 5 years" under it, both from tool results. If equity never turns positive within 60 months, say "Equity stays below zero for the loan" (no green).
3. **The walk-away view:**
   - the same single-line chart at full size, with the slider and axis labels in dollars;
   - the sentence at the slider month: "Sell at month 36: about $10,100 is yours" (or "you'd owe about $X" before the crossing);
   - the table's "You get back" column renamed "Your equity";
   - the old two-line chart removed;
   - the headline changed to "Positive equity by month 7."
4. **Words everywhere.** Replace "underwater" in the UI, the summary templates and the system prompt with positive-equity phrasing. Grep for "underwater", "Underwater" and "above water", and record every change. The model's follow-up replies must use the new phrasing too.
5. **Tests.**
   - With fixtures, `positiveEquityMonth` equals a brute-force scan.
   - The equity at 60 equals resale at 60 minus balance (0).
   - The never-positive case.
   - The templates.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px, in light and dark: SUV near 60614. Screenshot the card and the walk-away view under `~/.cache/low-key/screens/039/` (not in git).

## Stop and report
In `ops/reports/039-lowkey-equity-chart.md`: the wording changes, the screenshots, the live commit, and questions for Dylan.
