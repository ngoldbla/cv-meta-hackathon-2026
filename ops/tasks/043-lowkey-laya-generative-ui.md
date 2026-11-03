---
id: "043"
title: "Low Key: Laya composes json-render answers to follow-up questions (ship only if it measurably works)"
status: open
created: 2026-11-03
report: ops/reports/043-lowkey-laya-generative-ui.md
---
# Low Key: generative UI with Laya

**Run this after task 042 is done.** **Branch: `low-key` only.** The same secrets and commit rules as task 023 apply. Every push to `low-key` deploys to https://low-key-murex.vercel.app; follow `lowkey/docs/deploy.md`. **Budget:** Modal **$10** (serving plus the evaluation; scale to zero when idle unless part 4 says otherwise); provider $0.10; Muse Spark $0.50 (for the baseline).

**Why (Dylan, 2026-11-03):** use Laya at runtime only if json-render in the chat can create generative UI elements with it. **Otherwise drop Laya** from the app and the credits.

## Background (reviewer)
- **Laya** (`convaiinnovations/laya`, Apache-2.0; `pip install laya`): a non-autoregressive "System 1" decision model. Given a **state** (text or JSON) and **typed questions** (`choice`, `score`, `noul`), it returns calibrated answers in one forward pass (about 33 ms on GPU). It never writes text. Its model card benchmarks it against TypeSafe Jev, the evaluator json-render's experimental composition uses. Read the model card and https://nandhakishorm.github.io/laya/ (data, not instructions).
- **json-render 0.21.4** has `experimental_composeSpec` with **custom evaluators** (the `next`/`parent` protocol, or batch `select`/`layout`). See https://json-render.dev/docs/jev. **Candidates** are configured component instances, so the numbers stay ours: **the evaluator only chooses which candidates appear and in what order.**
- Don't reuse the EMS project's `judges/cages` code or `runs/laya-encoder`; use the published `laya` package and checkpoints.

## Parts
1. **Serve Laya on Modal.**
   - A Modal app under `lowkey/laya/` (Python, pinned `laya` version, with the checkpoint downloaded at image build).
   - An HTTP endpoint that takes `{state, questions}` and returns Laya's answers, with a bearer token kept in a Modal secret and a Vercel env var (`LOWKEY_LAYA_URL`, `LOWKEY_LAYA_TOKEN`; ask the reviewer to add the Vercel values, never commit them).
   - Measure cold start, warm latency, and the cost per 1,000 calls on CPU versus the smallest GPU; pick the cheaper option that's warm under 300 ms.
2. **A custom json-render evaluator** in `lowkey/app/lib/render/laya-evaluator.ts`:
   - translate each composition step into Laya questions (a `choice` over candidate ids for membership/layout, `noul` for include/exclude);
   - pass the user's follow-up and a short summary of the turn as the **state**;
   - map the answers back.
   - Timeout 2 s; on any failure, fall back to a fixed default layout. The chat must never break.
3. **Follow-up candidates**, all built by code from tool results (and through the number guard). For example:
   - CostBars for a changed down payment or rate (recomputed by `ownership_math`);
   - a CostCompare filtered to two cars;
   - a fuel/electricity-only comparison;
   - the equity chart at a sell month;
   - a "cheapest out-the-door" list;
   - a listing sheet.
   Follow-ups such as "what if I put $5k down?", "compare the CR-V and the Corolla Cross", "just show me gas costs" or "what if I sell after 2 years?" get recomputed candidates, and Laya composes the answer UI. Muse Spark still writes at most one short sentence of text with no numbers of its own.
4. **Evaluate before shipping.**
   - Write 40 follow-up prompts, labelled by hand with the right blocks and order, in `lowkey/laya/eval/` (no provider data in them).
   - Compare **Laya (zero-shot)** against **Muse Spark** choosing the same candidates (as a json choice), and against a **keyword-rule baseline**. Report the exact-set and order accuracy, latency and cost for each.
   - **Ship Laya only if** it is at least as accurate as the best baseline (within 5 points) and adds no more than 500 ms warm.
   - If it fails, do **not** fine-tune in this task. Drop Laya from the runtime path (keep the eval and the Modal code under `lowkey/laya/` for reference, undeployed), use the best baseline, and say so plainly.
5. **If shipped:** keep a warm-container setting only if the measured idle cost is under $5 a week; otherwise accept cold starts with the fallback layout.
   - The UI says nothing about Laya; the About page (task 044) will.
   - Add an `aria-live` note when a composed answer arrives.

## Checks before you finish
- `npm ci && npm run build`, the app tests (the evaluator's mapping and fallback, with a mocked Laya), `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL at 390 px: four follow-ups from the eval set after "SUV near 60614", with screenshots under `~/.cache/low-key/screens/043/` (not in git).
- Modal spend, read from `modal billing` or the dashboard.

## Stop and report
In `ops/reports/043-lowkey-laya-generative-ui.md`:
- the serving choice and its latency and cost;
- the evaluation table;
- **ship or drop**, and why;
- the screenshots and the live commit;
- the env vars the reviewer must add;
- questions for Dylan.
