# 052 report: hosted quote reader

## What changed
- `cloud/quote_reader/serve.py`: new CPU function `read_quote`. It calls Glimmer through the Hugging Face router on DeepInfra, using strict `json_schema` RawRead output, temperature 0, at most 6000 tokens and a 90 s timeout. A thin result gets a full-transcript retry. The result is normalized exactly as on the GPU.
  - On failure it falls back to `Reader().read` on the Modal GPU.
  - `/read` now spawns `read_quote`. `/warm` is a no-op.
  - Logs keep only the provider, time, token count and finish reason.
- `warm_window.py`: `on` sets `gpu_until` in the Modal Dict `lowkey-quote-route`, and reads go to the warm GPU until then. `off` and `redeploy.sh` clear it.
- `normalize.py`: an add-on the model paired but didn't tag as a fee ("Nitrogen tire fill") is now backfilled by name, with a new test. Before this, the hosted model's reads lost add-ons on 2 of 6 buyers' orders.
- App: the drawer's timing line now reads "usually 10 to 40 seconds", and the read limit is 240 s to cover the hosted attempt plus a cold GPU backup. The About page names Hugging Face Inference Providers (DeepInfra) and keeps Modal as the server and backup.
- Docs: README, CREDITS, `decision-model.md` and `roll-your-own.md` are updated.

## Data retention
DeepInfra (docs.deepinfra.com/account/data-privacy, checked 2026-11-04): "Input data is not stored to disk during inference", "Output data is not stored", "We do not log the content of your requests", and no training on submitted data (the exceptions are two third-party model families, neither used here). The drawer's "Nothing is stored" stays true.

## Results (deployed endpoint, the app's path)
| | Accuracy | Time per read |
|---|---|---|
| 12 invented fixtures, after the fees fix | 12/12 on every field, fees 6/6 | 9–26 s, no cold start |
| Toyota worksheet (real) | every money, VIN, rate and fee field equals the GPU read | 25 s (71 s while a second eval ran in parallel) |
| Lexus sticker (real) | equals the GPU read | 35 s (73 s in parallel) |
| Warm window on, Toyota | GPU path | 87 s while loading, then 18.6 s |

One mismatch remains on the Toyota: the GPU called it a buyers' order and the hosted model a payment offer. It changes no number.

## Cost
DeepInfra charges $0.30 per million input tokens and $1.20 per million output tokens, with no Hugging Face markup. A read writes 1,400–5,000 tokens, so it costs about $0.002–0.007. Pro's $2 a month of credit covers roughly 300–1,000 reads, and prepaid pay-as-you-go applies after that. Idle cost is zero.

## Open
- **Output length.** The hosted model writes far more for the same page: about 4,400 tokens for the Toyota against 795 on our GPU. That is most of its extra time. The cause isn't known yet; it may be padding inside the JSON, or the provider handling the shortened prompt differently. Looking at the raw content length would settle it.
- The Hugging Face token is the existing `huggingface` Modal secret. A fine-grained, inference-only token would be safer. Rotate it with the other keys before the public demo.
- Together needs pay-as-you-go enabled in the HF settings before it can serve as a second provider. Featherless works but takes 26–52 s.
- SAM 3.1 has no hosted provider, so task 048 stays on Modal.
