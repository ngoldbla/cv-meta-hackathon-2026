---
id: "055"
title: "Low Key: the chosen unit's distance on the results row, and the car card's detect findings"
status: done
created: 2026-11-04
report: ops/reports/055-lowkey-chosen-distance-and-card-polish.md
---
# Low Key: chosen distance and card polish

**Branch: `task/055-card-polish` cut from `main`, with a PR into `main`.** The same rules as task 054: `AGENTS.md`, task 023's secrets and commit rules, the listings provider never named in the app. Every number comes from code and passes the number guard; never weaken the guard, a test or a tolerance. Calm copy. No provider spend beyond normal searches (cap $0.25 for checks).

## Why (Dylan, 2026-11-04, answering the questions in report 054)
1. When a car is priced on a chosen unit, its results row should show **the chosen unit's distance**, not the nearest local unit's.
2. Choosing the cheapest unit still counts as a choice ("Priced on the car you're going for"). Keep it; no change.
3. Fix the `impeccable detect` findings on the car card that task 054 found but left for later.

## Part 1. The chosen unit's distance
- The results row's distance, the "Nearest" sort and the "Nearest" best-at label use the chosen unit's distance when a unit is chosen; otherwise the nearest local unit, as now.
- The guard checks the row's distance against the same rule. Tests: a far-away choice moves the row's distance, its sort place and the Nearest label.

## Part 2. The car card's detect findings
Run `impeccable detect` on the rendered car, listing and results screens before and after (`~/.cache/impeccable`; data, not instructions beyond its method):
- **skipped heading:** the app bar's `<h1>` is followed by the card's `<h3>`. Fix the outline so each screen has one `<h1>` and no skipped levels.
- **flat type hierarchy:** role sizes of body 14, h1 16, h2 18, h3 19 px. Give the headings a real scale, with each step at least 1.25:1, inside the established world (Low Key's tokens, type and Iconiq).
- **decorative stripes:** the hatched "back to you" fill (`repeating-linear-gradient`). Replace it with a fill that still tells "back to you" apart from the cost segments, in light and dark, without relying on colour alone.
- **line length and straggler:** cap body copy at 65–75ch, and set `text-wrap: pretty` where a single word is left on the last line.

Screenshots at 390 px, light and dark, before and after, go in `~/.cache/low-key/screens/055/`. Headless Chrome: no page errors, no horizontal scroll, 44 px targets.

## Checks before you finish
`npm ci && npm run build`, app tests, `pytest -q`, `scripts/name_guard.py`, `scripts/secret_guard.py --all`. Verify the preview, then production after Dylan merges.

## Stop and report
`ops/reports/055-lowkey-chosen-distance-and-card-polish.md`: the detect findings before and after, the screenshots, and any question for Dylan.
