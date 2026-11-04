# Report 056: trim the start screen
Status: done
Branch head at start: bd6ecce (main)

## Summary
- **Headline:** "Get a car without regret." becomes "Buy a car without regret."
- **Subtitle:** removed ("We help you buy for value and quality: the signal, not the noise.").
- **Location line:** stays on one line at every width. To fit, "Use my location" became a location icon button (its accessible name and tooltip are still "Use my location"), and "(approximate)" became "(approx.)" with the full word in an `<abbr>` title. If the line is still too long, the place name truncates with an ellipsis and its tooltip gives the full text; Change and the icon never wrap or shrink.
- **Footer:** removed; About was its only link. About stays in the header.

## Checked
- `npm ci && npm run build` and `npm test` (280 passed) in `lowkey/app`; `pytest -q` (83 passed); `name_guard.py` and `secret_guard.py --all` clean.
- Headless Chrome against a local `next start`: the location row is 44 px high (one line) at 320, 360 and 390 px, for an approximate area, a confirmed one and a long city name ("Rancho Santa Margarita"); no horizontal scroll; no `<footer>`. At 390 px "Near Atlanta, CA 92688 (approx.) · Change · [icon]" (a test value) fits in full; at 320 px only "(approx.)" truncates.

## Open
- At 320 px the start header ("About · Check a quote · GitHub") is clipped on the right. This predates this task and is left as it was.
- `lowkey/docs/prd.md` still quotes the old headline and subtitle as history; not changed.
