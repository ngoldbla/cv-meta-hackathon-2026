---
id: "049"
title: "Low Key: remove the chat, add plain settings and an optional intent bar (sentence in, JSON out)"
status: draft
created: 2026-11-04
report: ops/reports/049-lowkey-remove-chat-intent-bar.md
---
# Low Key: no chat

> **Draft, and a decision for Dylan.** Dylan is "strongly considering" removing the chat. Set `status: open` only when he confirms. Until then nothing here runs.

**Branch: `task/049-no-chat` cut from `main`, with a PR into `main`.** The same secrets and commit rules as task 023 apply. A merge into `main` deploys to https://lowkey.autos; follow `lowkey/docs/deploy.md`. No provider spend. **The Meta Model API credits are gone, so the intent bar's model call runs on the scale-to-zero Modal service from task 047** (an open-weights instruct model, or a small Glimmer head, served from the same Volume); Modal spend comes out of 047's $25.

**Why (reviewer's reading of the code, 2026-11-03):** the chat does three things. ZIP plus type is parsed by regex in `lib/fastpath.ts` with no model. Down payment and APR are parsed by regex too. The only live model use is a follow-up loop of up to 12 steps that calls the same tools and writes short prose with no numbers. Nothing the model writes is something Low Key wants, and the loop is blocked by the Meta billing error. Removing the prose also removes the need for a calm gate (task 045) and a layout contest (task 043): calm then holds by construction.

## Parts
1. **Settings as fields, not chat.** Replace the footer line "say 'my rate is 5.9%' in the chat" with plain controls: down payment ($ or %), term (36/48/60/72), APR (default from FRED, editable), and later "Include insurance". They feed the same fast path and the same number guard, with the same defaults (10% down, 60 months).
2. **The intent bar (optional input, not a chat).**
   - Keep one input. It takes a sentence and shows what was understood as chips ("Minivan · 60614 · $5k down"), each removable or editable; **no prose reply, no message history.** The cards below update.
   - Parsing: the existing regex first. Only a leftover phrase (a budget "under $450 a month", "no Toyota", "something for five people") goes to **one structured call to the open-weights model on Modal** that returns JSON validated by zod: `{zip?, category?, down?, apr?, term?, maxMonthly?, excludeMakes?, includeMakes?, sort?}`. The model fills slots; it never answers questions and never writes a number into the UI (any number it returns is shown in a chip the user can see and change).
   - Anything it cannot map becomes a calm chip-less line: "I couldn't use that part; try the fields above."
   - Timeout 6 s, and any failure falls back to the regex result. `maxMonthly`, makes and sort are applied by code over the existing lineup (the lineup rules stay intact: no more than four plus the commodity pick, no ranking by order).
3. **Remove the old loop.** Delete the follow-up `streamText` path, the system prompt and the model-facing tools in `app/api/chat/route.ts` and `lib/tools.ts`, keeping the fast path and the code the cards use. Remove `useChat` message rendering that only existed for model prose. Keep the URL state and the resume card from task 041.
4. **Glimmer experiment (optional; only after 1–3 are merged and the video is done).** Label 300 utterances; compare regex, Muse Spark JSON, and a Glimmer-L8 head (category/sort/intent only; numbers stay with the parser). Ship Glimmer only if it beats both on the held-out residual and fits a cold-start budget; otherwise record "tried" in `lowkey/docs/decision-model.md`.
5. **Tests.** Every existing fast-path test stays green; add tests for the chip parser (regex first, model fallback mocked, malformed JSON, a model returning an extra field), and a test that no model-written text reaches the page.

## Before this can run
- Task 047's Modal service exists, or the intent bar's model call waits; the rest of the task works without it.
- Dylan decides: remove the chat completely, or keep it hidden behind a flag for a short time.

## Checks and report
The usual build, test and guard commands; preview at 390 px, light and dark, with screenshots under `~/.cache/low-key/screens/049/`. Report: `ops/reports/049-lowkey-remove-chat-intent-bar.md`.
