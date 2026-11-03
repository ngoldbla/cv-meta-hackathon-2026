---
id: "035"
title: "Low Key: dark-mode segment colours and a \"cheapest to own\" tag in the comparison"
status: in_progress
created: 2026-11-03
report: ops/reports/035-lowkey-chart-polish.md
---
# Low Key: chart polish

**Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. Provider cap $0.05; Muse Spark cap $0.05.

Dylan approved these on 2026-11-03, answering report 034's questions:
- (1) Keep Pick #1 bold in the comparison, and tag the cheapest-to-own row.
- (2) No CostBars in the walk-away view (Muse's reasoning accepted). No change.
- (3) Follow-ups stay text for now. No change.

## Parts
1. **Dark-mode colours.** In `~/.cache/low-key/screens/034/03-crv-dark.png`, "value lost" and "gas" are both pale gold and hard to tell apart. Choose dark-theme values for the `--cost-*` tokens so that all four segments (loan, value lost, interest, gas) and the hatched "back to you" segment are clearly distinct from each other and from the track.
   - Keep value lost in the brass family and gas lighter, or change gas's hue if that reads better.
   - Check the contrast numerically: at least 3:1 between adjacent segments where possible, and 3:1 for each segment against the card background (WCAG non-text contrast). Record the ratios.
   - The light theme stays as it is, unless a pair there also fails 3:1. If one does, fix it and say so.
2. **The "cheapest to own" tag.**
   - In `CostCompare`, the row with the lowest real cost gets a small Iconiq `badge`, "cheapest to own", next to its name.
   - Pick #1 stays bold.
   - If Pick #1 is also the cheapest, show both: bold plus the tag.
   - Names wrap rather than truncate (keep the task-034 fix), and the tag wraps under the name at 390 px if needed.
   - The `aria-label` mentions it.
   - The number guard is unaffected; add a builder test for which row gets the tag, including a tie (both rows get the tag).

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px: SUV near 60614, in light and dark. Screenshots of the comparison and the CR-V card in both themes under `~/.cache/low-key/screens/035/` (not in git).

## Stop and report
In `ops/reports/035-lowkey-chart-polish.md`: the old and new token values, the contrast ratios, the screenshots, the live commit, and questions for Dylan.
