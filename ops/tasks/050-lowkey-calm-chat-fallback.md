---
id: "050"
title: "Low Key: no error in the chat without model credits — code handles rate and down-payment follow-ups, a calm fixed reply for the rest"
status: done
created: 2026-11-04
report: ops/reports/050-lowkey-calm-chat-fallback.md
---
# Low Key: a calm chat without model credits

**Why (Dylan, 2026-11-04):** ship for the hackathon. The Meta API has no credits, so on production any free-text follow-up returned "An error occurred". A judge typing a question must never see that.

## Parts
1. A newest message that only changes the down payment or the rate ("What if I put $5k down?", "my rate is 5.9%") runs the fast path with the conversation's ZIP and type: the cards re-price in code.
2. Any other free text gets one calm, fixed reply pointing to the controls and to Check a quote.
3. The model follow-up stays in the code behind `LOWKEY_CHAT_MODEL_ON=1` (off by default) for when credits return.
4. Tests for both paths. Task 049 (remove the chat) remains the fuller fix.
