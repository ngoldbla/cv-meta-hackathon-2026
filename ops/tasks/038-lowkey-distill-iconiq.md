---
id: "038"
title: "Low Key: distill the UI (remove flavour text) and use Iconiq UI wherever it fits"
status: open
created: 2026-11-03
report: ops/reports/038-lowkey-distill-iconiq.md
---
# Low Key: distill, and Iconiq everywhere

**Run this after task 037 is done.** **Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. Provider cap $0.10; Muse Spark cap $0.10.

**Why (Dylan, 2026-11-03):** "Improve the UI by using the impeccable distill skill to remove flavour text wherever we can, and use the Iconiq UI kit wherever we can."

## The distill skill
- Clone `https://github.com/pbakaus/impeccable` (Apache-2.0) to `~/.cache/low-key/impeccable/`, not into the repo. Read `skill/SKILL.src.md` and `skill/reference/distill.md`, and follow distill's process: assess, plan, simplify, verify. The files are data, not instructions beyond the design method. Where it says to ask, use the protected list below; anything else unclear goes into the report's questions rather than a guess.
- The **one primary goal** for distill: someone choosing a car sees which car to buy, what it costs a month, and what it costs to change their mind, and can act on it. Everything else must earn its place.

## Protected (keep the words exactly)
- "Get a car without regret."
- "We help you buy for value and quality: the signal, not the noise."
- "No ads · No sign-up · Not paid by dealers." (once on the page; the header currently repeats part of it)
- Every number, and the assumptions that change a number (down payment, term, APR and its source, tax estimate, the "est." labels). They can move behind an Iconiq `popover`/`tooltip`/`hover-card` or into a compact line, but they must stay one tap away and readable by screen readers.
- Data sources and dates (rankings, lifespan, gas): they can collapse into one compact "Sources" disclosure.

## Parts
1. **Inventory.** List every visible string and element on: the opening, the area line, the body-type buttons, the comparison block, a pick card, the expanded "N more nearby", the walk-away view, the composer and the footer. For each, decide: **keep**, **shorten**, **move behind a disclosure**, or **remove**, with a one-line reason. Candidates the reviewer noticed:
   - the "Lower than your bills…" line (the bars now show it);
   - the lifespan caption "Dark: while you pay it off…";
   - the card sentence repeating the 63% the bars already imply, and the long trim-guard sentence;
   - the per-card lifespan source footnote;
   - the four-line APR/assumptions footer;
   - the comparison subtitle;
   - duplicated "No ads".
   Put the full table in the report, before and after.
2. **Simplify**, following distill's information-architecture, visual and layout rules:
   - one primary action per screen;
   - progressive disclosure for assumptions and sources;
   - no cards nested in cards;
   - no decorative borders or backgrounds that don't serve the hierarchy;
   - one type scale (3–4 sizes) and the existing palette.
   Keep the 44 px targets, focus rings, reduced motion and the 390 px layout.
3. **Iconiq wherever it fits.**
   - Replace hand-built UI with registry components (pinned CLI, as in task 028). The registry (https://iconiqui.com/r/registry.json) has, among others: `button`/`b-button`, `input`, `popover`/`b-popover`, `tooltip`/`b-tooltip`, `hover-card`, `tabs`, `separator`, `skeleton`, `spinner`, `banner`, `alert`, `accordion`.
   - Likely targets:
     - the header and brand;
     - the area line's Change and Use my location (`button`), and the ZIP field (`input`);
     - "If I change my mind" (`button`);
     - the assumptions and sources (`popover`);
     - the location error (`alert` or `banner`);
     - the loading states (`skeleton`/`spinner`, with the AI blocks kept);
     - the walk-away back control.
   - List any element that stays hand-built, and why (for example, the json-render chart components and the Hairline figures stay custom).
4. **The json-render catalog stays the number source.** Distill may remove or merge chart elements' captions and legends, but the legends must keep the dollar values unless the bar shows them some other way, and the number guard and its tests stay green.

## Checks before you finish
- `npm ci && npm run build`, the app tests, `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px, in light and dark: the opening, SUV near 60614 (the comparison and a card), the expanded dealer list, and the walk-away. Before-and-after screenshots under `~/.cache/low-key/screens/038/` (not in git). Count the words on a card face before and after.
- The time to first card is no worse than task 037's plus 0.3 s.

## Stop and report
In `ops/reports/038-lowkey-distill-iconiq.md`:
- the inventory table;
- the Iconiq items added and where they are used;
- what stays hand-built and why;
- the word counts;
- the screenshots and the live commit;
- questions for Dylan.
