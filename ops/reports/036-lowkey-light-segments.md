# Report 036: Low Key: restore the light-mode pale gas and back colours; 2 px gaps between bar segments
Status: in_progress
Branch head at start: 7c5548ab818272b1f23fafa578277c90f50bea0c · at finish: (this commit)

## Summary
In progress.

## Work done
- Claimed task 036 on branch `low-key` (head `7c5548a`). Inbox sync on `main` not followed per the task's `low-key`-only rule — same approved deviation as tasks 022–035.
- Part 1 (light theme): restored the pale mockup tokens in `lowkey/app/app/globals.css` (`:root` only). Dark theme untouched.

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

## Deviations

## Blocked / questions
