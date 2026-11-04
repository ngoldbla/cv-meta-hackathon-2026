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
- **Serve on GPU only when summoned:** a `@app.cls` with the smallest GPU Run A/B shows is enough (an 80 GB card for bf16, or an L40S/24 GB class card for the GGUF), `min_containers=0`, `scaledown_window` 60–120 s, `max_containers=2` (a hard ceiling on spend), the Volume mounted read-only, weights loaded in `@modal.enter()`, and **GPU memory snapshots** (`enable_memory_snapshot`) tried to cut cold start. A plain `modal.Function` for `warm()` (loads the model, returns). Idle cost is zero.
- **Warm on intent:** the Check-a-quote drawer calls `/api/quote/warm` when it opens, so the container is loading while the user picks a photo. The UI says "Reading your photo can take up to a minute the first time" and never blocks the typed form.
- **Auth and abuse:** the Modal endpoint is reachable only from the Next.js route (Modal proxy auth token kept in Vercel env, never in the browser). The route limits requests per IP and per day, caps image size (resize to ≤1600 px on the client), and sets a daily request ceiling; past it, the form shows "Photo reading is resting; type it in."
- Measure and report: cold start, warm latency, cost per read, and the monthly cost at 100 reads/day.

## Parts
1. **Probe P23: access.** Checked 2026-11-04 with a CPU-only Modal function using the `huggingface` secret: **`meta-models/Muse-Glimmer-30B` is open (Apache-2.0, not gated)** and `Qwen/Qwen3-VL-8B-Instruct` is readable; `facebook/sam3.1` is gated (manual approval, needed by task 048). The Perception-LM and Llama 3.2 repos are also gated, but they are not the hackathon's models and are not candidates. Re-run the check for every repo you stage and record the result.
2. **Probe P24: Muse Glimmer-30B as the reader.** Per its model card (read it again for the current figures): a dense ~29.6B model with a ~1.8B perception encoder, text + image in and text out, trained for tool use and document/screenshot understanding, with a K-Quant GGUF of about 17 GB (the card says 24 GB VRAM) and an optional DFlash drafter. It is the hackathon's Meta open model and the product if it passes the gate.
   - **Run A (accuracy ceiling):** bf16 in `transformers` on one 80 GB GPU (A100-80GB or H100).
   - **Run B (cost):** the K-Quant GGUF with its vision projector under `llama.cpp` on an L40S or L4/A10G-class 24 GB GPU; compare accuracy loss against Run A.
   - Free dev loop: dylan-pc's 16 GB card can run the GGUF with partial offload for prompt iteration, after checking `nvidia-smi` shows no service holding it.
   - Baselines: **Qwen3-VL-8B (non-Meta, already in the `qwen3-vl-models` volume)** and an OCR + rules pass, as comparison only; never credited as the product.
   - Muse Spark Open (816B) is open but far too large to serve cheaply; out of scope. The hosted Muse Spark API is out of credits; no step may call it.
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
