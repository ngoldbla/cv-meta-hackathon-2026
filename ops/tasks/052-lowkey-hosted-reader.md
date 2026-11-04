---
id: "052"
title: "Low Key: read quote photos with Glimmer hosted on Hugging Face, Modal GPU as backup"
status: done
created: 2026-11-04
report: ops/reports/052-lowkey-hosted-reader.md
---
# Hosted quote reader

**Branch: `task/052-hf-reader` cut from `main`, with a PR into `main`.** The same secrets and commit rules as task 023 apply.

**Why (Dylan, 2026-11-04):** "Can we serve inference and models that we need directly from huggingface, using my profile and pro account? That way we don't have to worry about the startup times and we can serve the meta models but with no wait?"

## Do
- Route `/read` to a CPU Modal function that calls Muse Glimmer-30B through the Hugging Face router (`meta-models/Muse-Glimmer-30B:deepinfra`), with the same prompt, the RawRead JSON schema and `normalize.py`. Token from the Modal secret `huggingface`.
- If every hosted provider fails, run the same read on the Modal GPU (`Reader`).
- While `warm_window.py on` is active, route reads to the warm GPU first (it's faster on long pages); the routing flag expires on its own.
- `/warm` no longer wakes the GPU.
- Check the provider's data-retention terms before images go there; update the About page, README, CREDITS, decision-model and roll-your-own to match.

## Checks
The 12-fixture eval through the deployed endpoint, both real documents compared with the GPU reads, the warm-window routing, `pytest -q`, app tests and build, name and secret guards.
