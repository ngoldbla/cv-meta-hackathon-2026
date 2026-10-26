---
name: audit
description: Check literature claims against their sources and any public code, and record verdicts in research/claims.yaml. Use before building on any paper's numbers.
---
# Audit

1. List every quantitative claim the work relies on (abstract, tables, ablations).
2. For each claim, recompute it from the paper's own tables and compare it with the text. Record one of:
   - Supported
   - Overstated
   - Contradicted-by-own-data
   - Unverifiable
3. If code exists:
   - check its license before reading it for reuse (no license means no reuse; reimplement from the paper);
   - pin the commit SHA you inspected;
   - list each discrepancy you can verify against the raw source.
4. Append the results to `research/claims.yaml` with `id`, `claim`, `source`, `verdict`, `evidence`.
5. Worked example: `docs/paper-digest-tsai2025.md`.
