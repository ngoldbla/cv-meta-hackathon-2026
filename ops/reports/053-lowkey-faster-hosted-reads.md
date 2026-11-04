# 053 report: faster hosted reads

## Cause
The answer for a window sticker was 603 characters, about 200 tokens, but DeepInfra billed 2,093 completion tokens. Glimmer was reasoning before it answered. Our own vLLM path doesn't. The model card's `Reasoning strength: low` halved it. `chat_template_kwargs: {"enable_thinking": false}` cut it to about 700 tokens.

## Changes
- `serve.py`: hosted reads send `enable_thinking: false`.
- `normalize.py`, each fix with a test:
  - A VIN split into groups ("JTD LM5RC1TB212233") is joined, but only when the check digit holds.
  - A payment grid copied one row per line ("Purchase 60 Months 72 Months" / "$2,000 $500 - $525 $434 - $459") is split into cells before parsing.
  - A doc, dealer-service or processing fee is always a dealer fee, whatever the model tagged it.
- The drawer's timing line reads "usually 5 to 20 seconds"; roll-your-own is updated to match.

## Results (deployed endpoint)
| | Before (052) | After |
|---|---|---|
| 12 fixtures, two runs | 12/12 every field; 9–26 s | 12/12 every field, fees 6/6, both runs; about 5–10 s |
| Toyota worksheet (real) | 25 s | 9.5 s; every number and all 6 grid options equal the GPU read |
| Lexus sticker (real) | 35 s | 12.4 s; equal to the GPU read |
| Cost per read | about $0.003–0.007 | about $0.001–0.002 |

One difference from the GPU read: the Toyota's "Electronic Filing Fee" is now tagged dealer, not government. Dealer is the better reading, because the dealer charges it for filing paperwork electronically. The amount is unchanged.
