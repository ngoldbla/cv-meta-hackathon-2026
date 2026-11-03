# Report 035: Low Key: dark-mode segment colours and a "cheapest to own" tag in the comparison
Status: in_progress
Branch head at start: 66c4fbcf375ffe381f3a7cec878830a83daa771d · at finish: (this commit)

## Summary
In progress. Part 1 (segment colours) is done; Part 2 (the "cheapest to own" tag) is next.

## Work done
- Claimed task 035 on branch `low-key` (head `66c4fbc`). Inbox sync on `main` not followed per the task's `low-key`-only rule — same approved deviation as tasks 022–034.
- Part 1 (colours): viewed the task-034 dark screenshot (`~/.cache/low-key/screens/034/03-crv-dark.png`) — "value lost" and "gas" are the same pale gold there — then chose new `--cost-*` values in `lowkey/app/app/globals.css` and checked every contrast numerically (WCAG relative-luminance ratio). All ratios below are computed from the hexes, not estimated.

## Results
Token values (old → new). `—` means unchanged.

| Token | Dark | Light |
|---|---|---|
| `--cost-loan` | `#F3F2EE` — | `#1B1C1E` — |
| `--cost-lost` (value lost) | `#D9B96A` → `#C98A1F` | `#7A5A10` — |
| `--cost-interest` | `#A9A7A1` → `#64788D` | `#8E8A80` — |
| `--cost-gas` | `#D9C08A` → `#EED9A0` | `#D9C08A` → `#9C7C3A` |
| `--cost-back-a` | `#3E5E4A` → `#5F9273` | `#BFD6C4` → `#4F7D5C` |
| `--cost-back-b` | `#2F4A3A` → `#84B998` | `#D7E6DA` → `#6A9A76` |
| `--cost-back-bg` / `--cost-back-ink` | `#243528` / `#A9D3B3` — | `#EEF5EF` / `#2E5E3A` — |
| `--cost-track` | `#3A3B3E` — | `#E7E5DF` — |

Design, in words: value lost stays in the brass family but goes deep and saturated (`#C98A1F` in dark); gas stays lighter than it (pale straw `#EED9A0` in dark), so the two golds now differ in lightness and saturation instead of matching. Interest moves from warm grey to slate (`#64788D` in dark) so the middle segment differs from both golds by hue as well as lightness. The hatched "back to you" greens are lifted in dark so both stripes clear the card. No gas hue change was needed.

Contrast against the card background (dark card `#232426`, light card `#FFFFFF`; WCAG non-text target 3:1):

| Segment | Dark old | Dark new | Light old | Light new |
|---|---|---|---|---|
| Loan | 13.87 | 13.87 | 17.05 | 17.05 |
| Value lost | 8.21 | 5.28 | 6.37 | 6.37 |
| Interest | 6.46 | 3.41 | 3.44 | 3.44 |
| Gas | 8.77 | 11.15 | 1.77 ✗ | 3.92 |
| Back stripe A | 2.15 ✗ | 4.32 | 1.54 ✗ | 4.75 |
| Back stripe B | 1.60 ✗ | 6.93 | 1.29 ✗ | 3.23 |

Every segment in both themes now clears 3:1 against its card. In dark, each new segment also clears 3:1 against the page background (`#17181A`: loan 15.86, value lost 6.04, interest 3.90, gas 12.75, back A 4.95, back B 7.93). Against the track itself, the segments that actually touch it clear 3:1 in dark (value lost 3.81, gas 8.04, back A 3.12 on `--cost-track`; loan 10.00) and in light gas now clears it too (3.11; value lost 5.06, back A 3.77, loan 13.54). Interest never touches the track (it is always the middle segment) and the hatched segment always fills its bar to the scale end, so their track figures (dark interest 2.46, light interest 2.73 and back B 2.57) are not adjacencies that occur; their card figures above are the ones that apply (legend swatches sit on the card).

Adjacent-segment ratios (luminance only). Bar orders are loan|gas ("You pay"), value lost|interest|gas|back ("really costs" and the comparison rows), and loan|gas on the lifespan track:

| Pair | Dark old → new | Light old → new |
|---|---|---|
| Value lost \| interest | 1.27 → 1.55 | 1.85 → 1.85 |
| Interest \| gas | 1.36 → 3.27 | 1.94 → 1.14 |
| Loan \| gas | 1.58 → 1.24 | 9.63 → 4.35 |
| Gas \| back (stripe A) | 4.08 → 2.58 | 1.15 → 1.21 |
| Hatch A \| B | 1.34 → 1.60 | 1.19 → 1.47 |
| Value lost vs gas (same bar, not touching) | 1.07 → 2.11 | 3.60 → 1.62 |

Two honest limits. First, 3:1 between every touching pair at once is mathematically impossible alongside 3:1 against the card: in dark every segment must sit within a 5.2:1 luminance range above the card, but three touching steps at 3:1 each would need 27:1 (in light the range above white is 7:1, still short of 27:1). The worst pairs are therefore carried by hue, saturation and the hatch pattern — deep saturated brass against slate and against pale straw in dark; warm grey against olive-gold in light — and never by colour alone, since every legend carries the dollar values and every section's `aria-label` reads its numbers (task 034). Second, following the task's conditional, the light theme was not left untouched: its gas (1.77) and both back stripes (1.54, 1.29) failed 3:1 against the card, so those three tokens were darkened within their families (gas stays gold and lighter than value lost; the backs stay green). That darkening is why light interest|gas falls to 1.14 in luminance — the pair is now told apart by saturation (neutral grey against saturated gold) and by its legend. Light loan, value lost, interest, track and back panel colours are unchanged from the approved mockup.

## Deviations
- Light gas and back stripes changed (see Results): the task says to fix any light pair that fails 3:1, and those three failed against the card.

## Blocked / questions
