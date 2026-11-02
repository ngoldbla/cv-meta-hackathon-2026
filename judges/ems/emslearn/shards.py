"""Union of several rollout directories in the Volume, as one flat directory (M5 data reuse), and the hold filter.

A training script reads `<data>/*.npz`; `merge` lets it read the latest few iterations' shards together. The
window is at most MAX_DIRS directories (plan 2026-11-01-m5-pace-correction, Amendment 1).

`drop_hold_labels` removes the counterfactual labels of "hold" (Amendment 2): a reviewer check on 48 dev decisions
found that the 3-h label's verdict on a hold agreed with the end-of-day verdict only 18 times in 40, while
unit-choice effects show within minutes. Hold options keep their features but get no label, and a decision whose
logged choice was hold loses its whole label (its deltas are relative to a hold outcome).
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from pathlib import Path

import numpy as np

MAX_DIRS = 8


def drop_hold_labels(shard: Mapping[str, np.ndarray]) -> dict[str, np.ndarray]:
    from .policy import FEATURES

    out = {k: shard[k] for k in shard}
    hold = out["X"][:, :, FEATURES.index("is_hold")] > 0
    delta = np.array(out["delta"], copy=True)
    delta[hold] = np.nan
    delta[hold[np.arange(len(delta)), out["choice"].astype(np.int64)]] = np.nan
    out["delta"] = delta
    return out


def merge(root: Path, dirs: list[str], into: Path,
          transform: Callable[[Mapping[str, np.ndarray]], dict[str, np.ndarray]] | None = None) -> int:
    """One file per shard in `into`, named `<dir with / as _>-<shard>`: a symlink, or a transformed copy."""
    if len(dirs) > MAX_DIRS:
        raise ValueError(f"{len(dirs)} data directories; the window is at most {MAX_DIRS}")
    into.mkdir(parents=True, exist_ok=True)
    n = 0
    for d in dirs:
        d = d.strip().strip("/")
        files = sorted((root / d).glob("*.npz"))
        if not files:
            raise FileNotFoundError(f"no shards in {root / d}")
        for f in files:
            dst = into / f"{d.replace('/', '_')}-{f.name}"
            if transform is None:
                dst.symlink_to(f)
            else:
                with np.load(f) as z:
                    np.savez(dst, **transform(z))
            n += 1
    return n
