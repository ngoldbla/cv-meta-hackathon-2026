---
id: "025"
title: "Low Key: scaffold the chat app in lowkey/app (deployable to Vercel, stub tools)"
status: open
created: 2026-11-03
report: ops/reports/025-lowkey-app-scaffold.md
---
# Low Key: scaffold the chat app

**Branch: `low-key` only.** The same secrets and commit rules as task 023 apply (read its *Secrets* and *Rules* sections). **This repository is public.** No live provider or EIA calls are needed. The Muse Spark cap for this task is $0.50.

**Goal:** a minimal, deployable Next.js chat app in `lowkey/app` that Vercel can build with Root Directory `lowkey/app`. It talks to Muse Spark and uses stub tools. Real data comes in a later task.

## Deploys (added 2026-11-03, before this task started)
- **Every push or merged PR to `low-key` deploys to production at https://low-key-murex.vercel.app.** Vercel builds `lowkey/app` with Next.js on Node 22.x. The environment variables are already set in Vercel.
- Your push for this task will be the first deploy that can succeed, so `npm ci && npm run build` must pass before you push.
- Read `lowkey/docs/deploy.md` and follow its rules.
- In the report, give the commit you pushed. If you check, also say whether the URL served the app.

## Read first
- `lowkey/docs/prd.md`: the product, especially "Architecture (minimal)", "What the user sees" and the lineup rules.
- The mockup (four phone screens: ask, picks, walk-away, cost to run). Its look: IBM Plex Sans for text and IBM Plex Mono for numbers; ground `#F3F2EE`, card `#FFFFFF`, ink `#1B1C1E`, muted `#5A5C60`, line `#DAD8D1`, brass accent `#7A5A10`; a key icon next to the "Low Key" name; "No ads · No sign-up" in the header.

## Build
1. **Template choice (P14).**
   - Start from the smallest open-source Vercel AI SDK chat template or example that supports tool calls and a custom OpenAI-compatible base URL, and **needs no database and no auth**.
   - Record the template, its licence and the commit or version you used in the report.
   - Don't use a template that requires Postgres, auth or paid services.
2. **Model.**
   - Use the AI SDK's OpenAI-compatible provider with `baseURL` `https://api.meta.ai/v1`, key `process.env.META_API_KEY`, and model `process.env.LOWKEY_CHAT_MODEL ?? "muse-spark-1.3"`.
   - Muse Spark spends hidden reasoning tokens. Allow at least 1000 output tokens, or use a lower reasoning effort if the provider supports it.
3. **Chat route.**
   - One route handler with `export const maxDuration = 60`, and a system prompt that enforces the PRD:
     - one opening question (ZIP and sedan, SUV or pickup);
     - at most 4 picks plus the commodity pick;
     - plain words; no invented numbers.
4. **Tools (stubs).**
   - `rank_category`, `ownership_math` and `local_units`, with the input and output shapes from the PRD and task 023's P10 definitions.
   - Back them with fixture data clearly marked as sample data.
   - `ownership_math` must be the real, deterministic loan and walk-away maths (payment, balance, walk-away cost at 6, 12, 24, 36 and 60 months, underwater month), with unit tests against known amortisation values. Only its inputs are stubbed.
5. **UI.**
   - Mobile first. Chat messages, plus tool results rendered as **cards**, not text walls: rank, make and model, monthly payment, keeps-after-5-years, leave-at-1-year, above-water month, best local price, and a dealer link.
   - Show a "SAMPLE DATA" tag while the tools are stubs.
   - No ads, no sign-up, no analytics trackers.
6. **Config.**
   - Commit `lowkey/app/.env.example` with variable **names only**: `META_API_KEY=`, `LOWKEY_CHAT_MODEL=`, `LOWKEY_PROVIDER_KEY=`, `LOWKEY_PROVIDER_BASE_URL=`, `LOWKEY_PROVIDER_MCP_URL=`.
   - Never commit `.env`, `.env.local` or any value. Make sure `node_modules/` and `.next/` are git-ignored. Commit the lockfile.
   - Pin dependency versions exactly as the lockfile resolves them.
   - Node 22 is available on dylan-pc (`~/.local/bin/node`).

## Checks before you finish
- `npm ci && npm run build` in `lowkey/app` succeeds.
- The app's tests pass, including the `ownership_math` tests.
- `npm run dev`, then one real chat turn ("60614, SUV") with the key loaded from `~/.config/low-key/env` in the shell environment only, never written to a file in the repository. It returns cards from the stub tools. Record the latency.
- `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.

## Stop and report
In `ops/reports/025-lowkey-app-scaffold.md`:
- the template chosen and why;
- the build result and test counts;
- the latency of the real chat turn and the tokens used;
- the exact Vercel settings to use: Root Directory `lowkey/app`, framework preset, Node version, and the environment variable names;
- anything in the PRD the template can't do;
- questions for Dylan.
