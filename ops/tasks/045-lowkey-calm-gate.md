---
id: "045"
title: "Low Key: a calm-tone and number-safety check on every model reply"
status: open
created: 2026-11-03
report: ops/reports/045-lowkey-calm-gate.md
---
# Low Key: the calm gate

**Run this after task 043 is done.** **Branch: `task/NNN-<slug>` cut from `main`, with a PR into `main`.** The same secrets and commit rules as task 023 apply. A merge into `main` deploys to https://lowkey.autos; follow `lowkey/docs/deploy.md`. Modal spend comes out of task 043's $80 total. Muse Spark $0.50. Keep this to about 3 hours.

**Why (Dylan, 2026-11-03):** Low Key should sound super calm at all times. A decapitated model can't write, but it can judge: it scores each Muse Spark reply before the user sees it.

## Parts
1. **What it checks,** for each model reply (follow-ups only; the cards are code):
   - **calm:** no urgency, pressure, hype, exclamation marks, "act now", "don't miss" or sales talk; plain and reassuring;
   - **no stray numbers:** no number that isn't in that turn's tool results (an existing rule, now checked automatically);
   - **on topic:** the cars, the costs, the app, and calm car-buying practice.
2. **The model.** Use **the same backbone that won task 043** (see `lowkey/docs/decision-model.md`).
   - If Glimmer won: add a second head to the cut-down Glimmer for these three yes/no checks.
   - If Laya won: use Laya's yes/no questions zero-shot.
   - If neither won: a small head on Glimmer-L8 is still allowed here, if it beats the regex baseline below.
   - Training data: about 1,500 replies, half calm and half pushy, written from templates and paraphrase rules (or Muse outputs only if 043's licence check allowed it), plus 60 hand-labelled test replies never trained on.
   - **Baseline:** a regex/wordlist check plus the existing number guard.
3. **Wiring.**
   - The reply streams to a buffer and is checked when it completes (follow-ups are short).
   - Pass: show it.
   - Fail: regenerate once, with the reason added to the system prompt ("Rewrite calmly; no numbers that aren't in the tool results").
   - Fail again: show a fixed plain fallback ("Here's what changed:" plus the code-built blocks).
   - Timeout 1 s on the check; a check failure shows the reply only if the number guard passes.
   - Never block the cards.
4. **Ship only if it beats the baseline** on the test set: higher recall on pushy replies at no more than 5% false alarms on calm ones, and adding no more than 400 ms warm. Otherwise ship the regex baseline and say so. Add the result to `lowkey/docs/decision-model.md`.

## Checks before you finish
- `npm ci && npm run build`, the app tests (the gate's pass, regenerate and fallback paths with a mocked model), `pytest -q`, `scripts/name_guard.py` and `scripts/secret_guard.py --all` pass.
- On the deployed URL: five follow-ups designed to tempt a pushy reply ("should I buy today before the price goes up?"). Record each reply and its gate result.

## Stop and report
In `ops/reports/045-lowkey-calm-gate.md`: the test table against the baseline, ship or drop, the five live replies, the latency, Modal spend so far (043 + 045), the live commit, and questions for Dylan.
