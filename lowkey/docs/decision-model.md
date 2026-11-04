# Decision models in Low Key

What was tried, what shipped, and what didn't (task 044 credits from this file only).

| Model | Status | Where |
|---|---|---|
| **Muse Glimmer 30B** (Meta, Apache-2.0), full model | **Shipped** (task 047): reads a photo of a dealer sheet or window sticker, hosted on Hugging Face Inference Providers (task 052) with a scale-to-zero Modal GPU as backup. It emits a transcript, label/value pairs and fee tags under grammar-constrained decoding; code decides every field. | `cloud/quote_reader/` |
| **Headless Glimmer** (Glimmer with the language-model head removed, first 8 or 12 layers) | Kept in the repo as a decision trunk from the earlier EMS work; **not used at runtime**. Tasks 043 and 045 were superseded when the chat stopped writing prose; the chat itself was removed in task 049. | `headless-glimmer/` |
| **Laya** | **Not used.** Task 043 was superseded before any run. | — |
| **Muse Spark** (hosted API) | Wrote chat follow-ups during development (tasks 023–050). **Removed** with the chat in task 049: Low Key is now an interactive web app, and settings are real controls. | — (the chat route was deleted in task 049) |
| **SAM 3.1** (Meta) | Weights staged; **not yet used** (task 048, coming next). | — |
