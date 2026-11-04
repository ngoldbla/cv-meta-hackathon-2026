---
id: "047"
title: "Low Key: read a photo of a dealer sheet or window sticker into the Quote form — open-weights vision model on scale-to-zero Modal GPU"
status: draft
created: 2026-11-04
report: ops/reports/047-lowkey-quote-reader.md
---
# Low Key: the quote reader

> **Draft.** Dylan sets `status: open` after review. **Run this after task 046 is done.**

**Branch: `task/047-quote-reader` cut from `main`, with a PR into `main`.** The same secrets and commit rules as task 023 apply. A merge into `main` deploys to https://lowkey.autos; follow `lowkey/docs/deploy.md`. **Spend caps:** provider **$0.10** (VIN calls only). **Meta Model API: none; the credits are gone, so no step may call it.** Modal **$25** in total for staging, probes and the first week live (report `modal` usage before and after each part). The reader runs on **Modal serverless GPU that costs nothing while idle** (see Infrastructure).

**Why (Dylan, 2026-11-04):** "photograph a dealer sheet or a sticker on a car and have a Meta model find the info and convert it into JSON", with the VIN lookup supplying the car's details. The model reads; code decides.

## Principles
- **The model only reads.** It returns the Quote schema's fields as JSON and nothing else: no advice, no arithmetic, no prose. Every number it returns is shown to the user in an editable field and counts only once the user confirms it.
- **The VIN is the anchor.** Validate it in code (17 characters, no I/O/Q, the check digit). A VIN that fails is shown as unread, never "fixed" by the model.
- **Images are not stored.** Process in memory, log nothing from the image or its text, drop both when the request ends, and say so on screen. Rate-limit the endpoint.
- **If a probe fails, say so and ship less.** The typed form from task 046 is the fallback and stays.

## Infrastructure (scale to zero, prestaged)
- **App** `lowkey-quote-reader` in `cloud/quote_reader/` (Modal profile `ngoldbla`), deployed with `modal deploy`. One Volume, `lowkey-quote-models`, holds the weights.
- **Prestage on cheap CPU, never on the GPU:** a CPU-only function (`stage`) runs `snapshot_download` for each chosen model into the Volume, then `volume.commit()`. Use `HF_HUB_DISABLE_XET=1` if downloads stall (a known issue on this machine). Pin each model by revision hash. Run it once per model, off the request path.
- **Serve on GPU only when summoned:** a `@app.cls` with `gpu="L4"` (or A10G if the model needs it), `min_containers=0`, `scaledown_window` 60–120 s, `max_containers=2` (a hard ceiling on spend), the Volume mounted read-only, weights loaded in `@modal.enter()`, and **GPU memory snapshots** (`enable_memory_snapshot`) tried to cut cold start. A plain `modal.Function` for `warm()` (loads the model, returns). Idle cost is zero.
- **Warm on intent:** the Check-a-quote drawer calls `/api/quote/warm` when it opens, so the container is loading while the user picks a photo. The UI says "Reading your photo can take up to a minute the first time" and never blocks the typed form.
- **Auth and abuse:** the Modal endpoint is reachable only from the Next.js route (Modal proxy auth token kept in Vercel env, never in the browser). The route limits requests per IP and per day, caps image size (resize to ≤1600 px on the client), and sets a daily request ceiling; past it, the form shows "Photo reading is resting; type it in."
- Measure and report: cold start, warm latency, cost per read, and the monthly cost at 100 reads/day.

## Parts
1. **Probe P23: access.** Run `modal run` of a tiny CPU function (secret `huggingface`) that checks which candidate repos the token can read. Checked 2026-11-04: `facebook/Perception-LM-3B`, `facebook/Perception-LM-8B`, `meta-llama/Llama-3.2-11B-Vision-Instruct` and `meta-llama/Llama-3.2-3B-Instruct` are **gated and not yet granted** (Dylan must request access on huggingface.co with the `ndgold` account; approval is manual); `Qwen/Qwen3-VL-8B-Instruct` (17.5 GB) is readable and is already staged in the volume `qwen3-vl-models` from March. Record the result for every repo before staging.
2. **Probe P24: which open model reads best.** Candidates, in order: Perception-LM (3B, 8B) and Llama 3.2 11B Vision (Meta open weights; read their model cards and licences, including any territory limits, and record what you find rather than assuming), with **Qwen3-VL-8B as a non-Meta baseline only** (never credited as the product). Run each on the test set (part 4) on an L4 or A10G. Meta open weights are the product if one passes the gate; if none does, ship the typed form and say so. Don't swap in another vendor's model as the product without asking Dylan.
3. **Probe P25: the VIN lookup.** One call to the provider's `GET /v1/vins/{vin}` for a VIN of a car in the current lineup that the provider lists. Record: the fields returned (build, options, listing price, dealer, status), the cost per call, the 404 behaviour, and whether the licence allows showing a VIN and its fields in the app (read the terms; if unclear, say so and ask Dylan).
4. **The test set.** 12 synthetic dealer sheets and window stickers (rendered from templates with invented data: varied layouts, a Monroney-style label, a buyer's order with fee lines, a monthly-payment offer sheet), each with a hand-written truth file, then degraded like phone photos (angle, glare, blur). **No real person's data in the repo.** Dylan may supply 3 photos of his own paperwork or a sticker, kept out of git under `~/.cache/low-key/`.
5. **Score.** Field-level exact match for VIN (after the check digit), price, APR, term and each fee line, for each model tried and for a plain OCR + rules baseline. **Gate:** wire a model only if it reaches at least 90% on VIN, price, APR and term on the synthetic set. Otherwise ship the form alone and write up why.
6. **Wiring, if it passes.**
   - `/api/quote/read` (calls the Modal endpoint above): image in, JSON out (zod-validated), VIN check in code, optional VIN lookup to fill year/make/model/trim and the listed price for comparison.
   - A "Photograph a sheet or sticker" button in the Check-a-quote drawer. The read fields appear in the form, **highlighted as "read from your photo — please check"**, and the compare stays disabled until each money field is confirmed.
   - Timeout 90 s (cold start included); on any failure, a calm line ("Couldn't read that one; you can type it in") and the form.
7. **Glimmer.** If the baseline plus the vision model leave a clear error class (for example, labelling a fee as `addon` vs `dealer`), a small Glimmer head for that **text** classification step may be tried, and it ships only if it beats the rule baseline on held-out lines. Say tried or not tried in the report.

## Checks before you finish
- The usual build, test and guard commands pass, plus tests for the VIN check digit and the schema validation of model output (malformed JSON, extra fields, a hallucinated price field that the user hasn't confirmed).
- On the preview at 390 px: read a synthetic sticker and a buyer's order end to end. Screenshots under `~/.cache/low-key/screens/047/` (not in git).

## Stop and report
In `ops/reports/047-lowkey-quote-reader.md`: the three probe results, the score table, what was wired and what wasn't, costs, and questions for Dylan.
