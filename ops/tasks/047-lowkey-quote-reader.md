---
id: "047"
title: "Low Key: read a photo of a dealer sheet or window sticker into the Quote form — probe Meta models first, wire only what works"
status: draft
created: 2026-11-04
report: ops/reports/047-lowkey-quote-reader.md
---
# Low Key: the quote reader

> **Draft.** Dylan sets `status: open` after review. **Run this after task 046 is done.**

**Branch: `task/047-quote-reader` cut from `main`, with a PR into `main`.** The same secrets and commit rules as task 023 apply. A merge into `main` deploys to https://lowkey.autos; follow `lowkey/docs/deploy.md`. **Spend caps:** provider **$0.10** (VIN calls only); Meta Model API **$2.00** in total for the probes (report usage before and after); Modal **$10** if an open-weights model is tried there, or use dylan-pc's GPU for free after checking `nvidia-smi` and that no service holds the card.

**Why (Dylan, 2026-11-04):** "photograph a dealer sheet or a sticker on a car and have a Meta model find the info and convert it into JSON", with the VIN lookup supplying the car's details. The model reads; code decides.

## Principles
- **The model only reads.** It returns the Quote schema's fields as JSON and nothing else: no advice, no arithmetic, no prose. Every number it returns is shown to the user in an editable field and counts only once the user confirms it.
- **The VIN is the anchor.** Validate it in code (17 characters, no I/O/Q, the check digit). A VIN that fails is shown as unread, never "fixed" by the model.
- **Images are not stored.** Process in memory, log nothing from the image or its text, drop both when the request ends, and say so on screen. Rate-limit the endpoint.
- **If a probe fails, say so and ship less.** The typed form from task 046 is the fallback and stays.

## Parts
1. **Probe P23: Muse Spark with an image.** Does the Meta Model API accept an image input to Muse Spark, and does it return JSON that parses against the schema (JSON mode or a constrained response)? Record the request shape and cost per call.
2. **Probe P24: an open-weights reader.** Name the Meta open-weights vision-language models you can actually run (check their model cards and licences; record what you find, don't assume). Try the best candidate on dylan-pc or Modal. If none is usable, say so; don't substitute another vendor's model without asking.
3. **Probe P25: the VIN lookup.** One call to the provider's `GET /v1/vins/{vin}` for a VIN of a car in the current lineup that the provider lists. Record: the fields returned (build, options, listing price, dealer, status), the cost per call, the 404 behaviour, and whether the licence allows showing a VIN and its fields in the app (read the terms; if unclear, say so and ask Dylan).
4. **The test set.** 12 synthetic dealer sheets and window stickers (rendered from templates with invented data: varied layouts, a Monroney-style label, a buyer's order with fee lines, a monthly-payment offer sheet), each with a hand-written truth file, then degraded like phone photos (angle, glare, blur). **No real person's data in the repo.** Dylan may supply 3 photos of his own paperwork or a sticker, kept out of git under `~/.cache/low-key/`.
5. **Score.** Field-level exact match for VIN (after the check digit), price, APR, term and each fee line, for each model tried and for a plain OCR + rules baseline. **Gate:** wire a model only if it reaches at least 90% on VIN, price, APR and term on the synthetic set. Otherwise ship the form alone and write up why.
6. **Wiring, if it passes.**
   - `/api/quote/read`: image in, JSON out (zod-validated), VIN check in code, optional VIN lookup to fill year/make/model/trim and the listed price for comparison.
   - A "Photograph a sheet or sticker" button in the Check-a-quote drawer. The read fields appear in the form, **highlighted as "read from your photo — please check"**, and the compare stays disabled until each money field is confirmed.
   - Timeout 20 s; on any failure, a calm line ("Couldn't read that one; you can type it in") and the form.
7. **Glimmer.** If the baseline plus the vision model leave a clear error class (for example, labelling a fee as `addon` vs `dealer`), a small Glimmer head for that **text** classification step may be tried, and it ships only if it beats the rule baseline on held-out lines. Say tried or not tried in the report.

## Checks before you finish
- The usual build, test and guard commands pass, plus tests for the VIN check digit and the schema validation of model output (malformed JSON, extra fields, a hallucinated price field that the user hasn't confirmed).
- On the preview at 390 px: read a synthetic sticker and a buyer's order end to end. Screenshots under `~/.cache/low-key/screens/047/` (not in git).

## Stop and report
In `ops/reports/047-lowkey-quote-reader.md`: the three probe results, the score table, what was wired and what wasn't, costs, and questions for Dylan.
