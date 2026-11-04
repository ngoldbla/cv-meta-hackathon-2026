# Report 036: Low Key: restore the light-mode pale gas and back colours; 2 px gaps between bar segments
Status: done
Branch head at start: 7c5548ab818272b1f23fafa578277c90f50bea0c · at finish: (this commit)

## Summary
Done. Light mode is back to the pale mockup gas (`#D9C08A`) and "back to you" greens (`#BFD6C4` / `#D7E6DA`) with the dark theme untouched, and every segmented bar now separates touching segments with a 2 px gap of the card colour — flex `gap` over a card background in CostBars and CostCompare, a centred card strip on the lifespan track. The pale segments' card ratios (1.77 / 1.54 / 1.29) are recorded below; their edges are carried by the gaps, legends and `aria-label`s. All checks pass and the deployed app at 390 px shows the pales and gaps in both themes.

## Work done
- Claimed task 036 on branch `low-key` (head `7c5548a`). Inbox sync on `main` not followed per the task's `low-key`-only rule — same approved deviation as tasks 022–035.
- Part 1 (light theme, commit `3b03683`): restored the pale mockup tokens in `lowkey/app/app/globals.css` (`:root` only). Dark theme untouched.
- Part 2 (gaps, commit `9385b15`): added 2 px card-colour gaps in `CostBars.tsx` (both bars), `CostCompare.tsx` (every row) and `LifespanTrack.tsx` (loan|gold boundary). Number guard and tests unchanged; no style snapshot exists to update.
- Checks: clean `npm ci && npm run build` in `lowkey/app`; app tests **135 passed**; `pytest -q` **154 passed, 1 skipped** (`.venv/bin/python -m pytest -q`); `scripts/name_guard.py` exit 0; `scripts/secret_guard.py --all` clean; `ruff check .` clean.
- Deployed check (https://low-key-murex.vercel.app, headless Chrome at 390 px, live code commit `9385b15b10b87a346e03c32043f288b0909fb01c`): "SUV near 60614" (ZIP 60614, then SUV) in light, dark by emulated `prefers-color-scheme` with no second turn in the final session. Two earlier framing sessions were discarded (see Deviations); every session's turn took the card fast path. Screenshots saved under `~/.cache/low-key/screens/036/` (not in git).

## Results
Token values. Dark is unchanged from task 035; light loan, value lost and interest are unchanged.

| Token | Dark (unchanged) | Light before → after |
|---|---|---|
| `--cost-gas` | `#EED9A0` | `#9C7C3A` → `#D9C08A` |
| `--cost-back-a` | `#5F9273` | `#4F7D5C` → `#BFD6C4` |
| `--cost-back-b` | `#84B998` | `#6A9A76` → `#D7E6DA` |

Light contrast against the card (`#FFFFFF`, WCAG relative-luminance ratio; the restored figures match report 035's "old" column, computed there from the same hexes):

| Segment | vs card |
|---|---|
| Loan `#1B1C1E` | 17.05 |
| Value lost `#7A5A10` | 6.37 |
| Interest `#8E8A80` | 3.44 |
| Gas `#D9C08A` (restored) | 1.77 |
| Back stripe A `#BFD6C4` (restored) | 1.54 |
| Back stripe B `#D7E6DA` (restored) | 1.29 |

The three restored pales are below 3:1 against the card by themselves. That is the accepted trade in this task: segment boundaries are carried by the 2 px gaps (part 2). The gap is the card colour, so every segment edge meets the card at that segment's card-contrast ratio above — the pale edges are low-contrast against the card, and the numbers are carried by the legends (with dollar values) and each bar's `aria-label`, as in the task's rationale. Adjacent-segment luminance with the pales restored (for the record; gaps, hue and hatching separate them, not luminance alone): value lost|interest 1.85, interest|gas 1.94, loan|gas 9.63, gas|back-A 1.15, hatch A|B 1.19, value lost vs gas (same bar, not touching) 3.60.

How the gaps were done (part 2, part 3's boundary note included). In the flex bars the container changed from `bg-background` to `bg-card` and gained `gap-[2px]`, so the 2 px between touching segments is the card token (`--card`: `#FFFFFF` light, `#232426` dark) in both themes; the bars keep `overflow-hidden rounded-[5px]`, so the rounded ends are unchanged. Segment `width: %` values are unchanged, so widths still sum to the scale (bills total in CostBars, shared max in CostCompare); on a full bar the gaps overflow by 2 px per boundary and flex shrink takes that out of the track width across the segments, not out of one segment, and every positive segment has `minWidth: 2`, so a segment under 4 px still shows at least 2 px of colour (zero-amount segments stay at zero). Covered boundaries: CostBars "You pay" loan|gas (1 gap); CostBars "really costs" value lost|interest, interest|gas, gas|hatched "back to you" (3 gaps — the hatch's internal A/B stripes are one segment and keep no gaps); CostCompare value lost|interest and interest|gas in every row (2 gaps); lifespan loan|gold (1 gap). The lifespan track is absolutely positioned, so its gap is centred on the loan boundary: the loan part ends 1 px early, the gold part starts 1 px late, a 2 px `bg-card` strip covers the track line between them, the lifespan marker does not move, and each positive part keeps `minWidth: 2`. Because the gap is the card colour, each segment's edge contrast is exactly its "vs card" ratio in the table above (dark edges likewise keep their task-035 card ratios: loan 13.87, value lost 5.28, interest 3.41, gas 11.15, back A 4.32, back B 6.93).

Deployed (live commit `9385b15b10b87a346e03c32043f288b0909fb01c`; live CSS checked for `#d9c08a` / `#bfd6c4` before the browser run, then read back in-page). One "SUV near 60614" turn: the comparison shows Venue $383 tagged "cheapest to own", Corolla Cross $446, CR-V $461 bold as Pick #1, CX-50 $504, 4Runner $731. The CR-V card reads $743 ($577 loan + $166 gas) / $461 ($197 + $97 + $166) / $282 back, matching the mockup. In-page probe (light): `--cost-gas #d9c08a`, `--cost-back-a #bfd6c4`, `--cost-back-b #d7e6da` on card `#fff`, and the first six flex bars all compute `gap: 2px` on `rgb(255, 255, 255)`; the live `aria-label` reads "Hyundai Venue, cheapest to own: 383 dollars a month: 159 value lost, 68 interest, 156 gas. … Honda CR-V: 461 dollars a month: 197 value lost, 97 interest, 166 gas. …" Dark probe: `--cost-gas #eed9a0`, backs `#5f9273` / `#84b998` on card `#232426`, unchanged. In the screenshots the light gas reads pale tan against the white gaps and the hatched remainder pale green; in dark the gaps read as thin card-dark lines between amber, slate and cream. The card path is the fast path (no model call, $0, as in report 035); provider usage was not meter-read, so no provider figure is claimed against the $0.05 caps.

Screenshots (390 px, not in git): `~/.cache/low-key/screens/036/01-compare-light.png`, `02-crv-light.png`, `03-compare-dark.png`, `04-crv-dark.png`. Each is a viewport capture with its target scrolled to the top of the frame.

## Deviations
- Final screenshots are viewport captures (390 × 844) rather than 390 px crops: the full-page stitch hides the card bars under the fixed chat input on this page, and the first clip attempt framed the wrong card ancestor. Two framing sessions were discarded for that reason; their SUV turns also took the $0 fast path.
- No other deviation. Dark tokens, light loan / value lost / interest, the number guard and all tests are untouched.

## Blocked / questions
- Nothing blocked. For Dylan: the restored light pales sit at 1.77 / 1.54 / 1.29 against the card and are told apart by the 2 px card gaps, hue and the hatch, with legends and `aria-label`s carrying the dollars — approve on the live build, or say if any boundary still reads as merged at 390 px.
