# Report 050: a calm chat without model credits
Status: done

## Summary
Production returned `{"type":"error","errorText":"An error occurred."}` for any free-text follow-up (checked on lowkey.autos, 2026-11-04: "Which one is quietest on the highway?"). Now down-payment and rate follow-ups re-price the cards in code (no model, faster), and anything else gets a calm fixed reply that points to the controls and to Check a quote. The model path is kept behind `LOWKEY_CHAT_MODEL_ON=1`, off by default.

## Work done
- `lowkey/app/lib/fastpath.ts`: the newest message triggers the fast path when it gives a ZIP, a type, a down payment or a rate (with a ZIP and type known from the conversation).
- `lowkey/app/app/api/chat/route.ts`: `calmReplyResponse()`, a fixed text reply in the chat's own stream format; the model call runs only with `LOWKEY_CHAT_MODEL_ON=1` and a key.
- Tests: `lib/fastpath.test.ts` (down and rate follow-ups re-price; still need a ZIP and type; other text isn't a fast request), `app/api/chat/route.test.ts` (no error part; the calm reply). `vitest.config.mts` adds the `@/` alias so route handlers can be tested.

## Results
`npm ci && npm run build`, 226 app tests, `pytest -q`, name_guard and secret_guard pass. Production check after merge: see the PR.

## Deviations
The reply's examples ("$5k down", "my rate is 5.9%") are fixed copy, the same examples the footer already shows; no model writes any number.
