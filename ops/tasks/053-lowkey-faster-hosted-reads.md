---
id: "053"
title: "Low Key: faster hosted quote reads (thinking off) and the parsing fixes it needed"
status: done
created: 2026-11-04
report: ops/reports/053-lowkey-faster-hosted-reads.md
---
# Faster hosted reads

**Branch: `task/053-faster-hosted-reads` cut from `main`, with a PR into `main`.** Follow-up to 052: hosted reads billed about 2,000 hidden reasoning tokens for a 200-token answer. Turn thinking off, then fix whatever the leaner reads break, in code (normalize.py), with tests. Check with the 12-fixture eval (twice) and both real documents against the GPU reads.
