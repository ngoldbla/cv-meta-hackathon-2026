---
id: "033"
title: "Low Key: one dealer unit on the card face, the others behind \"N more nearby\""
status: open
created: 2026-11-03
report: ops/reports/033-lowkey-one-unit.md
---
# Low Key: one unit on the card

**Run this after task 032 is done.** **Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. Provider cap $0.05; Muse Spark cap $0.05.

Dylan approved both answers to report 031's questions on 2026-11-03:
1. The Venue's step cost stays priced off the cheapest SEL variant (+$2,050). No change.
2. The card face shows one unit again.

## Parts
1. **The "Distance to the dealer" row shows only the cheapest unit:** "2026 CR-V LX · $31,950 · 13.7 mi · AutoNation Honda O'Hare · See the car", plus its leftover-year note if it has one.
2. **The others go behind a tap:** a small "2 more nearby" control below it (the count is the real number of other units, and it's hidden when there are none). Tapping it expands the same one-line format for each in place, and the control becomes "Show less". Use an Iconiq collapsible/accordion if the registry has one (pinned CLI, as in task 028); otherwise a native `<details>`/`<summary>`. Keyboard accessible, a 44 px touch target, and it respects reduced motion.
3. If any hidden unit is a leftover year, its note appears with it when expanded, not on the face.
4. Tests (logic level, fixtures): 0, 1 and 3 units give the right face unit and count ("2 more nearby" for 3, nothing for 1); the face unit is the cheapest by price with fees.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px: SUV near 60614. One unit on each card face, expand and collapse one card, and screenshot both states under `~/.cache/low-key/screens/033/` (not in git).

## Stop and report
In `ops/reports/033-lowkey-one-unit.md`: the component used, the screenshots, the live commit, and questions for Dylan.
