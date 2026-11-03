---
id: "036"
title: "Low Key: restore the light-mode pale gas and back colours; 2 px gaps between bar segments"
status: open
created: 2026-11-03
report: ops/reports/036-lowkey-light-segments.md
---
# Low Key: light-mode segments

**Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. Provider cap $0.05; Muse Spark cap $0.05.

## Why (reviewer, approved by Dylan 2026-11-03)
In `~/.cache/low-key/screens/035/01-compare-light.png`, the darkened light gas (`#9C7C3A`) is now hard to tell from value lost (`#7A5A10`). Telling the segments apart matters more than contrast against the card, and the legends (with dollar values) and the `aria-label`s already carry the numbers. Answers to report 035:
- (1) Keep the mockup's pale colours in light mode.
- (2) Separate the segments with gaps, not patterns.

## Parts
1. **Light theme:** restore `--cost-gas` to `#D9C08A`, and `--cost-back-a` and `--cost-back-b` to `#BFD6C4` and `#D7E6DA` (the mockup values). The dark theme keeps its task-035 values. Light loan, value lost and interest are unchanged.
2. **Gaps:** in every segmented bar (CostBars "You pay" and "really costs", CostCompare rows, and the lifespan track's two parts), put a **2 px gap of the card background** between touching segments, for example with `gap: 2px` on the flex bar over a card-coloured background, or `box-shadow`/`border` in the card token. The bar keeps its rounded ends, and segment widths still sum to the scale, so take the gaps out of the track width rather than out of a segment. Very small segments (under 4 px) keep at least 2 px of colour.
3. **Record** the light ratios for the restored tokens against the card, and note that the boundaries are carried by the gaps: the gap is the card colour, so every segment's edge has its card-contrast ratio. Keep the number guard and the tests unchanged except for any style snapshot.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px: SUV near 60614 in light and dark. Screenshot the comparison and the CR-V card in both themes under `~/.cache/low-key/screens/036/` (not in git).

## Stop and report
In `ops/reports/036-lowkey-light-segments.md`: the token values, how the gaps were done, the screenshots, the live commit, and questions for Dylan.
