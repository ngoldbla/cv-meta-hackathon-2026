# Report 036: Low Key: restore the light-mode pale gas and back colours; 2 px gaps between bar segments
Status: in_progress
Branch head at start: 7c5548ab818272b1f23fafa578277c90f50bea0c · at finish: (this commit)

## Summary
In progress.

## Work done
- Claimed task 036 on branch `low-key` (head `7c5548a`). Inbox sync on `main` not followed per the task's `low-key`-only rule — same approved deviation as tasks 022–035.
- Part 1 (light theme, commit `3b03683`): restored the pale mockup tokens in `lowkey/app/app/globals.css` (`:root` only). Dark theme untouched.
- Part 2 (gaps): added 2 px card-colour gaps in `CostBars.tsx` (both bars), `CostCompare.tsx` (every row) and `LifespanTrack.tsx` (loan|gold boundary). Number guard and tests unchanged; no style snapshot exists to update.

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

## Deviations

## Blocked / questions
