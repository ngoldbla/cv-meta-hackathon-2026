"""Decapitate and truncate a causal LM into a decision backbone (Jev-style "System One" trunk).

* decapitate: drop the language-model head (and any vision tower) -- the trunk only emits hidden states;
* truncate: keep the first ``keep_layers`` transformer blocks;
* drop token embeddings: decisions are fed as projected feature tokens via ``inputs_embeds``.

Weights are streamed tensor-by-tensor from safetensors shards, so a 30B checkpoint can be cut down
without materialising it.  Works for Llama-style checkpoints (``<prefix>embed_tokens``,
``<prefix>layers.N.*``, ``<prefix>norm``), including Muse Glimmer's language model.

    python -m cages.model.decapitate meta-models/Muse-Glimmer-30B runs/glimmer-L8 --keep-layers 8
"""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path


def _snapshot(src: str) -> Path:
    p = Path(src)
    if p.exists():
        return p
    from huggingface_hub import snapshot_download

    return Path(snapshot_download(src, allow_patterns=["*.json", "*.safetensors"]))


def _weight_files(root: Path) -> list[Path]:
    idx = root / "model.safetensors.index.json"
    if idx.exists():
        files = sorted(set(json.loads(idx.read_text())["weight_map"].values()))
        return [root / f for f in files]
    return sorted(root.glob("*.safetensors"))


def _text_prefix(keys) -> str:
    cands = [k[: -len("embed_tokens.weight")] for k in keys if k.endswith("embed_tokens.weight") and "vision" not in k]
    if not cands:
        cands = [k.split("layers.")[0] for k in keys if ".layers.0." in k or k.startswith("layers.0.")]
    if not cands:
        raise ValueError("could not locate the text decoder in this checkpoint")
    return min(cands, key=len)


def decapitate(src: str, out: str, keep_layers: int, dtype: str = "bfloat16", drop_embeddings: bool = True) -> dict:
    import torch
    from safetensors import safe_open
    from transformers import AutoConfig, AutoModel

    root = _snapshot(src)
    cfg = AutoConfig.from_pretrained(root)
    text_cfg = copy.deepcopy(getattr(cfg, "text_config", None) or cfg)
    n_orig = int(text_cfg.num_hidden_layers)
    if not 1 <= keep_layers <= n_orig:
        raise ValueError(f"keep_layers must be in [1, {n_orig}]")
    text_cfg.num_hidden_layers = keep_layers
    if getattr(text_cfg, "layer_types", None):
        text_cfg.layer_types = list(text_cfg.layer_types)[:keep_layers]
    if drop_embeddings:
        text_cfg.vocab_size = 1
    torch_dtype = getattr(torch, dtype)
    model = AutoModel.from_config(text_cfg, dtype=torch_dtype)

    files = _weight_files(root)
    keys = []
    for f in files:
        with safe_open(f, "pt") as h:
            keys.extend(h.keys())
    prefix = _text_prefix(keys)
    state, kept, dropped = {}, 0, 0
    for f in files:
        with safe_open(f, "pt") as h:
            for k in h.keys():
                if not k.startswith(prefix):
                    dropped += 1
                    continue
                rest = k[len(prefix):]
                if rest.startswith("layers."):
                    if int(rest.split(".")[1]) >= keep_layers:
                        dropped += 1
                        continue
                elif rest.startswith("embed_tokens") and drop_embeddings:
                    dropped += 1
                    continue
                state[rest] = h.get_tensor(k).to(torch_dtype)
                kept += 1
    missing, unexpected = model.load_state_dict(state, strict=False)
    missing = [m for m in missing if not (drop_embeddings and m.startswith("embed_tokens"))]
    if unexpected or any("layers." in m for m in missing):
        raise RuntimeError(f"weight mismatch: missing={missing[:5]} unexpected={unexpected[:5]}")
    outp = Path(out)
    outp.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(outp)
    meta = {
        "source": str(src), "original_layers": n_orig, "kept_layers": keep_layers,
        "dropped": ["lm_head", "vision tower", "layers >= kept"] + (["token embeddings"] if drop_embeddings else []),
        "tensors_kept": kept, "tensors_dropped": dropped, "hidden_size": int(text_cfg.hidden_size),
        "params": int(sum(p.numel() for p in model.parameters())), "dtype": dtype,
    }
    (outp / "decapitation.json").write_text(json.dumps(meta, indent=1))
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--keep-layers", type=int, required=True)
    ap.add_argument("--dtype", default="bfloat16")
    ap.add_argument("--keep-embeddings", action="store_true")
    a = ap.parse_args()
    print(json.dumps(decapitate(a.src, a.out, a.keep_layers, a.dtype, not a.keep_embeddings), indent=1))


if __name__ == "__main__":
    main()
