"""Union of several rollout directories in the Volume, as one flat directory of symlinks (M5 data reuse).

A training script reads `<data>/*.npz`; `merge` lets it read the latest few iterations' shards together. The
window is at most MAX_DIRS directories (plan 2026-11-01-m5-pace-correction, Amendment 1).
"""

from __future__ import annotations

from pathlib import Path

MAX_DIRS = 8


def merge(root: Path, dirs: list[str], into: Path) -> int:
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
            (into / f"{d.replace('/', '_')}-{f.name}").symlink_to(f)
            n += 1
    return n
