# EMS anchor report (b0 on held-out anchor days)

Overall: FAIL

| check | sim | observed | tolerance | ok |
|---|---|---|---|---|
| tier 1 response p50 (min) | 4.505 | 4.900 | ±10% | yes |
| tier 1 response p90 (min) | 11.128 | 8.000 | ±15% | NO |
| tier 2 response p50 (min) | 5.810 | 6.433 | ±10% | yes |
| tier 2 response p90 (min) | 14.361 | 11.033 | ±15% | NO |
| tier 3 response p50 (min) | 7.672 | 9.133 | ±10% | NO |
| tier 3 response p90 (min) | 20.446 | 22.533 | ±15% | yes |
| held share | 0.063 | 0.077 | ±0.03 | yes |
| transports per day | 2875.689 | 2854.951 | ±5% | yes |
| offload median (min) | 35.036 | 36.017 | ±10% | yes |
| Jan 2018 held-share increase | 0.163 | 0.121 | ±0.05 | yes |

## Known limits (frozen 2026-11-01, Dylan)

- The tier-1 and tier-2 response p90 are too long in simulation (11.1 vs 8.0 min; 14.4 vs 11.0 min).
- The tier-3 median is too short (7.7 vs 9.1 min).
- The likely causes are more even real unit positioning and dispatchers holding units back for urgent calls.
- Round 3 tried both, failed through a fit bug, and was not retried, to keep the anchors blind.
