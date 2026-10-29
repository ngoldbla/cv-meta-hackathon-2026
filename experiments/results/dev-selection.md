# Dev selection for the E3 arms (dev only, 40 instances)

Rule: ledger seq 8. Each arm takes the candidate and threshold with the lowest
mean dev P95. References: express_rule P95 2622.63, staging P95 2220.78
(`experiments/results/dev-baselines/summary.json`). Evaluator v2.0,
SHA-256 `97e924f8…`. Per-run sources:
`experiments/results/dev-<run>/{summary.json,dev_eval.json}`.

## Mean metrics per run and threshold

P95 / CVaR95 / peak density are means over 40 dev instances. Fallback is the
call-weighted mean `fallback_rate`.

| run | thr | P95 | CVaR95 | peak | fallback |
|---|---|---|---|---|---|
| evac-glimmer-L8-r16 | 0.0 | 2152.13 | 2323.31 | 5.83 | 0.000 |
| evac-glimmer-L8-r16 | 0.2 | 2145.73 | 2328.07 | 5.83 | 0.102 |
| evac-glimmer-L8-r16 | 0.35 | 2191.53 | 2359.68 | 5.86 | 0.797 |
| evac-glimmer-L12-q16 | 0.0 | 2148.03 | 2331.44 | 5.82 | 0.000 |
| evac-glimmer-L12-q16 | 0.2 | 2155.40 | 2349.95 | 5.83 | 0.115 |
| evac-glimmer-L12-q16 | 0.35 | 2175.78 | 2364.23 | 5.86 | 0.905 |
| evac-laya-r16 | 0.0 | 2118.72 | 2286.38 | 5.80 | 0.000 |
| evac-laya-r16 | 0.2 | 2127.08 | 2284.77 | 5.80 | 0.094 |
| evac-laya-r16 | 0.35 | 2177.45 | 2353.00 | 5.85 | 0.826 |
| evac-scratch-20m | 0.0 | 2141.25 | 2316.29 | 5.84 | 0.000 |
| evac-scratch-20m | 0.2 | 2137.86 | 2312.90 | 5.83 | 0.068 |
| evac-scratch-20m | 0.35 | 2202.03 | 2371.48 | 5.86 | 0.822 |
| evac-scratch-20m-s1 | 0.0 | 2159.82 | 2324.61 | 5.84 | 0.000 |
| evac-scratch-20m-s1 | 0.2 | 2160.70 | 2325.33 | 5.84 | 0.081 |
| evac-scratch-20m-s1 | 0.35 | 2190.19 | 2369.81 | 5.86 | 0.851 |
| evac-scratch-20m-s2 | 0.0 | 2145.39 | 2315.67 | 5.83 | 0.000 |
| evac-scratch-20m-s2 | 0.2 | 2145.11 | 2314.55 | 5.82 | 0.078 |
| evac-scratch-20m-s2 | 0.35 | 2188.97 | 2364.64 | 5.86 | 0.823 |

## Paired change vs staging (mean relative change, bootstrap 95% CI, Wilcoxon p)

| run | thr | P95 | CVaR95 | peak density |
|---|---|---|---|---|
| L8-r16 | 0.0 | −2.92% [−4.03, −1.91], p = 1.6e-05 | −3.48% [−4.59, −2.43] | −0.48% (n.s.) |
| L8-r16 | 0.2 | −3.04% [−4.21, −1.99], p = 1.4e-05 | −3.38% [−4.48, −2.33] | −0.52% (n.s.) |
| L8-r16 | 0.35 | −1.12% [−1.81, −0.47] | −1.69% [−2.41, −1.03] | −0.06% (n.s.) |
| L12-q16 | 0.0 | −2.47% [−4.02, −0.93], p = 1.5e-03 | −2.88% [−4.37, −1.17] | −0.79% |
| L12-q16 | 0.2 | −2.11% [−3.76, −0.13], p = 1.8e-03 | −2.30% [−3.94, −0.23] | −0.60% |
| L12-q16 | 0.35 | −1.03% [−1.96, −0.24] | −1.10% [−1.91, −0.38] | +0.00% (n.s.) |
| laya-r16 | 0.0 | −3.45% [−4.85, −2.01], p = 6.2e-05 | −3.96% [−5.74, −2.18] | −1.15% |
| laya-r16 | 0.2 | −3.49% [−5.03, −1.97], p = 1.4e-04 | −4.66% [−6.24, −3.19] | −1.06% |
| laya-r16 | 0.35 | −2.00% [−3.29, −0.87] | −2.34% [−3.73, −1.27] | −0.35% (n.s.) |
| scratch-20m | 0.0 | −2.65% [−4.17, −1.24], p = 6.7e-04 | −3.18% [−4.20, −2.27] | −0.37% (n.s.) |
| scratch-20m | 0.2 | −2.56% [−4.13, −1.08], p = 1.3e-03 | −3.07% [−4.20, −2.02] | −0.45% |
| scratch-20m | 0.35 | −0.81% [−1.60, −0.02] | −1.28% [−1.92, −0.70] | −0.06% (n.s.) |
| scratch-s1 | 0.0 | −1.82% [−3.05, −0.50], p = 2.1e-03 | −2.76% [−3.80, −1.69] | −0.33% |
| scratch-s1 | 0.2 | −1.85% [−2.98, −0.71], p = 2.6e-03 | −2.75% [−3.82, −1.72] | −0.42% |
| scratch-s1 | 0.35 | −1.18% [−2.05, −0.41] | −1.50% [−2.43, −0.71] | −0.07% (n.s.) |
| scratch-s2 | 0.0 | −2.56% [−3.77, −1.38], p = 4.6e-04 | −3.17% [−4.23, −2.26] | −0.63% |
| scratch-s2 | 0.2 | −2.85% [−4.20, −1.52], p = 3.3e-04 | −3.42% [−4.47, −2.45] | −0.85% |
| scratch-s2 | 0.35 | −1.34% [−2.24, −0.49] | −1.61% [−2.62, −0.73] | −0.05% (n.s.) |

## Paired change vs express_rule

All mixtures beat express_rule on P95 by 19–21% (all p < 1e-10) and on CVaR95
by 15–18%. Peak-density gains are 3–4%, mostly significant. Full numbers are in
the per-run `summary.json` files.

## Mechanical application of the seq-8 rule

Lowest mean dev P95 per arm (bold = arm pick):

| arm | candidates (P95 @ best thr) | pick |
|---|---|---|
| Glimmer L8 | L8: 2152.13 @0.0, **2145.73 @0.2**, 2191.53 @0.35 | **L8 @0.2** |
| Glimmer L12 | L12: **2148.03 @0.0**, 2155.40 @0.2, 2175.78 @0.35 | **L12 @0.0** |
| Laya | Laya: **2118.72 @0.0**, 2127.08 @0.2, 2177.45 @0.35 | **Laya @0.0** |
| scratch-20M | s0: 2141.25 @0.0, **2137.86 @0.2**, 2202.03 @0.35; s1: 2159.82 @0.0 (best); s2: 2145.11 @0.2 (best) | **s0 @0.2** |

Seed spread for scratch (best-threshold P95): s0 2137.86, s1 2159.82, s2 2145.11
(range 21.96 s, 1.0%).

The E2 checkpoint is the lowest-dev-P95 candidate over everything that passes
the 50 ms p99 edge gate. Ranked by P95: laya@0.0 (2118.72), scratch-s0@0.2
(2137.86), scratch-s2@0.2 (2145.11), L8@0.2 (2145.73), L12@0.0 (2148.03),
scratch-s1@0.0 (2159.82). **E2 pick pending edge-gate results (Part F step 3).**
