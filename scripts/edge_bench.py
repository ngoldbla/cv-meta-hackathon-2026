"""Edge latency benchmark for the decision model (target: p99 <= 50 ms per decision on an
RTX 5060 Ti 16 GB).  Feeds real decision states from a CAGES shard one at a time.

    python scripts/edge_bench.py --model runs/decision-glimmer-L8-r16 --device cuda --quant nf4
"""

from __future__ import annotations

import argparse
import json
import time

import numpy as np
import torch

from cages.model.train import load_model, load_split


def bench(model_dir: str, data: str, device: str, quant: str, n: int, warmup: int = 20) -> dict:
    m = load_model(model_dir, quant=quant, device=device)
    d = load_split(data, "dev")
    idx = np.arange(len(d["car"]))
    lat = []
    if device == "cuda":
        torch.cuda.reset_peak_memory_stats()
    with torch.inference_mode():
        for k in range(n + warmup):
            i = idx[k % len(idx)]
            args = [torch.as_tensor(d[x][i:i + 1], device=device) for x in ("car", "floor", "glob")]
            mask = torch.as_tensor(d["mask"][i:i + 1], device=device, dtype=torch.bool)
            if device == "cuda":
                torch.cuda.synchronize()
            t0 = time.perf_counter()
            logits = m(*[a.float() for a in args], mask)
            int(torch.argmax(logits, -1)[0])
            if device == "cuda":
                torch.cuda.synchronize()
            if k >= warmup:
                lat.append((time.perf_counter() - t0) * 1000)
    out = {"model": model_dir, "device": device, "quant": quant, "n": n,
           "p50_ms": float(np.percentile(lat, 50)), "p99_ms": float(np.percentile(lat, 99)),
           "params": int(sum(p.numel() for p in m.parameters()))}
    if device == "cuda":
        out["peak_vram_gb"] = torch.cuda.max_memory_allocated() / 1e9
    out["meets_50ms_p99"] = out["p99_ms"] <= 50.0
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--data", default="datasets/cages-v0-mini")
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    ap.add_argument("--quant", default="none", choices=["none", "nf4"])
    ap.add_argument("--n", type=int, default=500)
    a = ap.parse_args()
    print(json.dumps(bench(a.model, a.data, a.device, a.quant, a.n), indent=1))
