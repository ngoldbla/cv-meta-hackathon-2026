---
id: "048"
title: "Low Key: SAM silhouettes — a dev tool that traces a model's true shape from a reference photo into a Hairline figure"
status: draft
created: 2026-11-04
report: ops/reports/048-lowkey-sam-silhouettes.md
---
# Low Key: SAM silhouettes for Hairline

> **Draft.** Dylan sets `status: open` after review. Independent of 046/047; it adds no runtime code to the app.

**Branch: `task/048-sam-silhouettes` cut from `main`, with a PR into `main`.** The same secrets and commit rules as task 023 apply. A merge into `main` deploys to https://lowkey.autos only if the app's files change; this task changes figures and a dev tool. **Spend cap:** Meta Model API **$2.00** (report usage before and after; one probe call first to price it, and stop and ask if the plan would exceed the cap). No provider spend.

**Why (Dylan, 2026-11-04):** "I need more photorealistic Hairline images. Use a SAM model to capture the true silhouette of the car in question and generate the Hairline drawing for the site", so a 2027 Honda Civic looks like a Civic, not a generic sedan. Calm, and still true to the thing being shown.

## Background
- Hairline figures are in `lowkey/app/lib/hairline/cars.ts` (five body-type figures today) and are drawn with the `hairline-create` skill (`~/.cache/low-key/hairline/skills/hairline-create`; work files in `~/.cache/low-key/hairline-work/`). Read both, and the PRD's rule that cars are line drawings and not photos, before starting.
- **SAM 3.1** is available through the Meta Model API. SAM 3 takes **text prompts for concepts** and returns masks; confirm in P26 what 3.1 accepts and returns, don't assume.

## Parts
1. **Probe P26: SAM 3.1 on a car photo.** With the text prompts "car", "wheel", "window", "headlight": does it return clean masks, in what format and size, at what cost per call? Record this before any further work.
2. **Reference images, rights first.** For each model to be drawn, use an image Dylan owns or that the manufacturer's media kit explicitly licenses for editorial use; record the source URL, the terms and the date in `lowkey/docs/figure-sources.md`. **Do not scrape dealer or listing photos** (the provider licence also limits `photo_urls`). Prefer one clean **side profile**, which gives the truest silhouette; a 3/4 view is a bonus to match Hairline's isometric pose. If a model has no usable image, skip it and say so.
3. **The tool** `lowkey/tools/silhouette/`:
   - image → SAM masks (car body, wheels, windows, lights) → contours → simplified polylines (a fixed tolerance, recorded) → a normalised outline file (JSON) in the coordinate frame the Hairline kernel expects;
   - a preview SVG for a quick look;
   - the original image is **never committed**; only the derived outline and the source record.
4. **Draw.** Feed the outline to `hairline-create` as the body shape, keep Low Key's rest pose and theming, and keep the figure count small. Start with **four**: Honda Civic (current generation and, if a reference exists, the 2027), Honda CR-V, Toyota Camry, Ford F-150. Each figure keeps the existing `FigureMount` format and passes the skill's validate and look tools.
5. **Look test.** Render each new figure next to the generic one at 390 px, light and dark, and show Dylan a side-by-side sheet. A figure ships only if the model reads as itself at card size. State honestly if line simplification lost the shape.
6. **Wire** the new figures into the card picker by model, falling back to the body-type figure when a model has none. Update tests.
7. **Roll-your-own note** for task 044's guide: a short `lowkey/tools/silhouette/README.md` showing a forker how to trace a motorcycle or a luxury car from a photo they own.

## Checks before you finish
- The usual build, test and guard commands pass; `name_guard` still passes (no provider or vendor naming in the app).
- Screenshots of the side-by-side sheet under `~/.cache/low-key/screens/048/` (not in git).

## Stop and report
In `ops/reports/048-lowkey-sam-silhouettes.md`: P26, sources and terms, what each figure looks like next to the generic one, cost, and questions for Dylan.
