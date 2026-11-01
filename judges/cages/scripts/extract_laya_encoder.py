"""Rebuild the Laya encoder-only checkpoint from the Hub, pinned to a revision.

Takes the ``encoder.*`` tensors from the root ``model.safetensors`` of
``convaiinnovations/laya``, strips the prefix, keeps the dtypes, and writes an
encoder-only directory (``config.json`` + ``model.safetensors``).

    python scripts/extract_laya_encoder.py --out /tmp/laya-rebuild
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

REPO = "convaiinnovations/laya"
# Current Hub main revision as resolved on 2026-10-28.
REVISION = "7b928d828b7b0e022f929d9bd2e44165aa270148"


def extract(repo: str, revision: str, out: str) -> dict:
    import torch
    from huggingface_hub import snapshot_download
    from safetensors import safe_open
    from safetensors.torch import save_file

    root = Path(snapshot_download(repo, revision=revision, allow_patterns=["encoder/config.json", "model.safetensors"]))
    outp = Path(out)
    outp.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / "encoder" / "config.json", outp / "config.json")
    state: dict[str, torch.Tensor] = {}
    with safe_open(root / "model.safetensors", framework="pt") as h:
        for k in h.keys():
            if k.startswith("encoder."):
                state[k[len("encoder."):]] = h.get_tensor(k)
    if not state:
        raise RuntimeError("no encoder.* tensors found in the root model.safetensors")
    save_file(state, outp / "model.safetensors")
    params = int(sum(t.numel() for t in state.values()))
    sha = hashlib.sha256((outp / "model.safetensors").read_bytes()).hexdigest()
    return {"repo": repo, "revision": revision, "tensors": len(state), "params": params, "sha256": sha}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=REPO)
    ap.add_argument("--revision", default=REVISION)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    print(json.dumps(extract(a.repo, a.revision, a.out), indent=1))


if __name__ == "__main__":
    main()
