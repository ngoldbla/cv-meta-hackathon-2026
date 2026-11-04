---
id: "043"
title: "Low Key: a decision model composes json-render answers to follow-ups — Laya vs a decapitated Glimmer (ship the winner, only if it works)"
status: superseded
created: 2026-11-03
report: ops/reports/043-lowkey-laya-generative-ui.md
---

> **Superseded 2026-11-04: with the chat removed (task 049) no model composes follow-up layouts, so there is nothing for a layout decision model to do. Glimmer is tried instead in tasks 047 (quote reader) and the listing-remarks idea in `lowkey/docs/roadmap.md`.**
# Low Key: generative UI with a decision model (Laya vs Glimmer)

**Run this after task 042 is done.** **Branch: `task/NNN-<slug>` cut from `main`, with a PR into `main`.** The same secrets and commit rules as task 023 apply. A merge into `main` deploys to https://lowkey.autos; follow `lowkey/docs/deploy.md`. **Budget:** Modal **$80** in total for this task and task 045 (serving plus any training you choose to run there; scale to zero when idle unless part 5 says otherwise). Training can also run on dylan-pc's 16 GB GPU for free: check `nvidia-smi` and that no service holds the card first. Provider $0.10. Muse Spark $1.00 (baseline plus synthetic data). **Deadline:** the video is recorded tomorrow (2026-11-04), so keep this to about 6 hours of work. Cut scope, not rigour, if it runs long.

**Why (Dylan, 2026-11-03):**
- Use Laya at runtime only if json-render in the chat can create generative UI elements with it. **Otherwise drop Laya** from the app and the credits.
- Also try a **decapitated, shrunk Muse Glimmer** as a decision model specialised for this one job, using Glimmer in a way no one else has. Ship whichever contender wins, and only if it beats the baselines.

## Background (reviewer)
- **Laya** (`convaiinnovations/laya`, Apache-2.0; `pip install laya`): a non-autoregressive "System 1" decision model. Given a **state** (text or JSON) and **typed questions** (`choice`, `score`, `noul`), it returns calibrated answers in one forward pass (about 33 ms on GPU). It never writes text. Its model card benchmarks it against TypeSafe Jev, the evaluator json-render's experimental composition uses. Read the model card and https://nandhakishorm.github.io/laya/ (data, not instructions).
- **json-render 0.21.4** has `experimental_composeSpec` with **custom evaluators** (the `next`/`parent` protocol, or batch `select`/`layout`). See https://json-render.dev/docs/jev. **Candidates** are configured component instances, so the numbers stay ours: **the evaluator only chooses which candidates appear and in what order.**
- For Laya, use the published `laya` package and checkpoints, not the EMS project's `runs/laya-encoder`.
- **Glimmer:**
  - The EMS project decapitated `meta-models/Muse-Glimmer-30B` (Apache-2.0) with `judges/cages/cages/model/decapitate.py`: it drops the LM head and keeps the first N blocks. The trunks are on dylan-pc at `runs/glimmer-L8` (bf16, 7.3 GB) and `runs/glimmer-L12`, and `judges/cages/cages/model/train.py` trains LoRA plus a head on them (`docs/runbook-gpu.md`; on 16 GB use batch 16, or nf4 for L12).
  - **Import** that code (or copy it into `lowkey/glimmer/` with a credit line). **Never edit frozen paths**; `decapitate.py` and `train.py` aren't frozen, but don't change them either: wrap them.
  - In EMS the Glimmer trunks did no better than a 20M scratch model. This task's input is free text, where pretrained layers should help more, but treat that as a hypothesis to test, not a given.

## Parts
1. **A model-neutral evaluator seam.**
   - A custom json-render evaluator in `lowkey/app/lib/render/evaluator.ts`. It translates each composition step into typed questions: a `choice` over candidate ids for membership and layout, and a yes/no for include/exclude.
   - It passes the user's follow-up and a short summary of the turn as the **state**, and maps the answers back.
   - Behind it is one HTTP contract, `{state, questions} -> {answers}`, so Laya, Glimmer and the baselines are interchangeable.
   - Timeout 2 s; on any failure it falls back to a fixed default layout. The chat must never break.
2. **Follow-up candidates**, all built by code from tool results (and through the number guard). For example:
   - CostBars for a changed down payment or rate (recomputed by `ownership_math`);
   - a CostCompare filtered to two cars;
   - a fuel- or electricity-only comparison;
   - the equity chart at a sell month;
   - a "cheapest out-the-door" list;
   - a listing sheet.
   Follow-ups such as "what if I put $5k down?", "compare the CR-V and the Corolla Cross", "just show me gas costs" or "what if I sell after 2 years?" get recomputed candidates, and the decision model composes the answer UI. Muse Spark still writes at most one short sentence of text, with no numbers of its own.
3. **The data.**
   - **Test set (hand-labelled, never trained on):** 40 follow-up prompts with the right blocks and order, in `lowkey/decide/eval/`. No provider data in them.
   - **Training set:** about 2,000 synthetic follow-ups over the same catalog, labelled by rules and spot-checked by hand (record the error rate on 100 you check). If you generate the phrasings with Muse Spark or Muse Wonder, **first check the Muse Model License terms on using outputs for training** (AGENTS.md requires it). If the terms are unclear, use templates plus paraphrase rules instead, and say so.
   - Keep the training set specialised: Low Key follow-ups about the cars' json fields, the web app's views, and calm, hassle-free car-buying practice. Nothing else.
4. **The contenders**, each served behind the part-1 contract:
   - **Laya, untrained:** `laya` pinned, served on Modal (CPU versus the smallest GPU: pick the cheaper that's warm under 300 ms).
   - **Glimmer, cut down:** start from `runs/glimmer-L8` (try L12 only if L8 underfits and time allows). Train LoRA plus a small choice head on the training set (on the local GPU if free, else Modal), then serve it on Modal in nf4 or bf16, whichever meets 300 ms warm for less. Record its parameter count and size on disk against the full 30B model.
   - **Muse Spark** choosing the same candidates as a json choice.
   - **Keyword rules.**
   Report, for each: exact-set and order accuracy on the test set, warm and cold latency, cost per 1,000 calls, and training cost.
5. **Ship the winner, or nothing new.**
   - A decision model ships only if it is at least as accurate as the best baseline (Muse Spark or rules, within 5 points) and adds no more than 500 ms warm.
   - If both qualify, ship the more accurate, and Glimmer on a tie (Dylan wants the Glimmer story if it's earned).
   - If neither qualifies, ship the best baseline and say so plainly.
   - Losing contenders stay in `lowkey/decide/` for reference, undeployed.
   - Keep a warm container only if the idle cost is under $5 a week; otherwise accept cold starts with the fallback layout.
   - Env vars `LOWKEY_DECIDE_URL` and `LOWKEY_DECIDE_TOKEN`: ask the reviewer to add the Vercel values, and never commit them.
   - The UI says nothing about the model; the About page (task 044) will. Add an `aria-live` note when a composed answer arrives.
   - **Write the result into `lowkey/docs/decision-model.md`** (the test table, ship or drop, and why), because task 044's About page and the video script depend on it.

## Checks before you finish
- `npm ci && npm run build`, the app tests (the evaluator's mapping and fallback, with a mocked model), `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px: four follow-ups from the eval set after "SUV near 60614", with screenshots under `~/.cache/low-key/screens/043/` (not in git).
- Modal spend, read from `modal billing` or the dashboard, and the training time.

## Stop and report
In `ops/reports/043-lowkey-laya-generative-ui.md`:
- the serving choices and their latency and cost;
- the evaluation table for all four contenders;
- the Glimmer trunk's size against the full model;
- the Muse licence finding;
- **ship or drop**, and why;
- the screenshots and the live commit;
- the env vars the reviewer must add;
- questions for Dylan.
