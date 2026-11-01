"""Paired statistics shared by every judge's frozen evaluator (lower metric values are better).

``paired`` reproduces the CAGES v2.0 evaluator's comparison exactly: mean relative change of a vs b
with a bootstrap 95% CI, and a Wilcoxon signed-rank p-value.  ``holm`` adjusts a family of p-values.
"""

from __future__ import annotations

import math

import numpy as np
from scipy import stats


def paired(xa, xb, n_boot: int = 2000, seed: int = 0) -> dict:
    xa, xb = np.asarray(xa, dtype=float), np.asarray(xb, dtype=float)
    ok = np.isfinite(xa) & np.isfinite(xb)
    xa, xb = xa[ok], xb[ok]
    rel = (xa - xb) / np.maximum(np.abs(xb), 1e-9)
    rng = np.random.default_rng(seed)
    boots = [rng.choice(rel, rel.size).mean() for _ in range(n_boot)] if rel.size else [np.nan]
    try:
        p = float(stats.wilcoxon(xa, xb).pvalue) if rel.size > 5 and np.any(xa != xb) else float("nan")
    except ValueError:
        p = float("nan")
    return {"n": int(rel.size), "mean_a": float(xa.mean()) if xa.size else np.nan,
            "mean_b": float(xb.mean()) if xb.size else np.nan, "rel_change": float(rel.mean()) if rel.size else np.nan,
            "ci95": [float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))], "wilcoxon_p": p}


def holm(pvalues: list[float]) -> list[float]:
    """Holm-Bonferroni adjusted p-values in input order; NaN entries stay NaN and do not count."""
    idx = sorted((i for i, p in enumerate(pvalues) if not math.isnan(p)), key=lambda i: pvalues[i])
    m, out, running = len(idx), [float("nan")] * len(pvalues), 0.0
    for rank, i in enumerate(idx):
        running = max(running, min(1.0, (m - rank) * pvalues[i]))
        out[i] = running
    return out
