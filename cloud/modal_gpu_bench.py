"""GPU cost/performance bake-off on Modal for the EMS learned-policy workload (run through cloud/budget.py).

The workload stands in for the blue loop's learned dispatch policy: a set-transformer over 64 call tokens and 512
unit tokens (32 features each) that scores every (call, unit) assignment, trained with cross-entropy on bf16
autocast. Three sizes span the plausible range. For each GPU type, one container measures, in order:
torch import and CUDA init, eager throughput over a batch sweep, torch.compile time and compiled throughput,
and peak memory. Data is synthetic and generated on the GPU (throughput does not depend on its values).

    ~/.local/bin/modal run cloud/modal_gpu_bench.py::build                 # build and cache the image (CPU only)
    python cloud/budget.py run --name gpu-bakeoff --price 19.97 --cap 6 -- \\
        ~/.local/bin/modal run cloud/modal_gpu_bench.py --out runs/gpu-bakeoff.json
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import modal

TORCH = "torch==2.15.0"
GPUS = ["L4", "A10", "L40S", "A100-40GB", "A100-80GB", "RTX-PRO-6000", "H100", "H200"]  # B200: not on Starter
SIZES = {"S": dict(d=128, layers=2), "M": dict(d=256, layers=4), "L": dict(d=512, layers=8)}
BATCHES = {"S": [256, 1024, 4096], "M": [128, 512, 2048], "L": [64, 256, 1024]}
N_CALL, N_UNIT, FEAT = 64, 512, 32

app = modal.App("ems-gpu-bakeoff")
image = modal.Image.debian_slim(python_version="3.12").pip_install(TORCH, "numpy")


def _model(d: int, layers: int):
    import torch
    from torch import nn

    class Policy(nn.Module):
        def __init__(self):
            super().__init__()
            self.inp = nn.Linear(FEAT, d)
            layer = nn.TransformerEncoderLayer(d, 8, 4 * d, dropout=0.0, batch_first=True, norm_first=True)
            self.enc = nn.TransformerEncoder(layer, layers, enable_nested_tensor=False)
            self.q, self.k = nn.Linear(d, d), nn.Linear(d, d)

        def forward(self, x):
            h = self.enc(self.inp(x))
            calls, units = h[:, :N_CALL], h[:, N_CALL:]
            return torch.einsum("bcd,bud->bcu", self.q(calls), self.k(units)) / d**0.5

    return Policy()


def _throughput(step, x, y, seconds: float = 4.0, warm: int = 3) -> float:
    import torch

    for _ in range(warm):
        step(x, y)
    torch.cuda.synchronize()
    n, t0 = 0, time.perf_counter()
    while time.perf_counter() - t0 < seconds:
        step(x, y)
        n += 1
    torch.cuda.synchronize()
    return n * x.shape[0] / (time.perf_counter() - t0)


@app.function(image=image, gpu="L4", timeout=1200)
def bench(gpu: str) -> dict:
    wall_start = time.time()
    t_start = time.perf_counter()
    import torch

    t_import = time.perf_counter() - t_start
    torch.cuda.init()
    torch.zeros(1, device="cuda")
    t_cuda = time.perf_counter() - t_start - t_import
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
    out = {"gpu": gpu, "device": torch.cuda.get_device_name(), "torch": str(torch.__version__),
           "cuda": torch.version.cuda, "mem_gib": torch.cuda.get_device_properties(0).total_memory / 2**30,
           "import_s": t_import, "cuda_init_s": t_cuda, "sizes": {}}
    for name, cfg in SIZES.items():
        model = _model(**cfg).cuda()
        params = sum(p.numel() for p in model.parameters())
        res = {"params": params, "eager": {}, "compiled": {}}
        for compiled in (False, True):
            m = torch.compile(model, dynamic=False) if compiled else model
            opt = torch.optim.AdamW(model.parameters(), lr=1e-4, fused=True)

            def step(x, y, m=m, opt=opt):
                with torch.autocast("cuda", dtype=torch.bfloat16):
                    loss = torch.nn.functional.cross_entropy(m(x).flatten(0, 1).float(), y.flatten())
                opt.zero_grad(set_to_none=True)
                loss.backward()
                opt.step()

            # eager: sweep the batch sizes; compiled: only the best eager batch (one compile per size)
            batches = BATCHES[name] if not compiled else [max(
                (b for b, v in res["eager"].items() if "samples_per_s" in v),
                key=lambda b: res["eager"][b]["samples_per_s"])]
            for b in batches:
                torch.cuda.empty_cache()
                torch.cuda.reset_peak_memory_stats()
                try:
                    x = torch.randn(b, N_CALL + N_UNIT, FEAT, device="cuda")
                    y = torch.randint(0, N_UNIT, (b, N_CALL), device="cuda")
                    t0 = time.perf_counter()
                    step(x, y)  # first step: includes compilation for this shape
                    torch.cuda.synchronize()
                    first = time.perf_counter() - t0
                    sps = _throughput(step, x, y)
                    res["compiled" if compiled else "eager"][b] = {
                        "samples_per_s": sps, "first_step_s": first,
                        "peak_gib": torch.cuda.max_memory_allocated() / 2**30}
                except torch.OutOfMemoryError:
                    res["compiled" if compiled else "eager"][b] = {"oom": True}
                    break
                finally:
                    x = y = None
        out["sizes"][name] = res
        del model
    out["in_container_s"] = time.perf_counter() - t_start
    out["wall_start"] = wall_start
    return out


@app.function(image=image)
def build() -> str:
    import torch

    return str(torch.__version__)


@app.local_entrypoint()
def main(out: str = "runs/gpu-bakeoff.json", gpus: str = ",".join(GPUS), deadline_s: int = 720):
    """Spawn one container per GPU type; save each result as it lands; cancel any still queued at the deadline."""
    t0 = time.time()
    pending = {g: bench.with_options(gpu=g).spawn(g) for g in gpus.split(",")}
    results: dict[str, dict] = {}
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    while pending and time.time() - t0 < deadline_s:
        for g, call in list(pending.items()):
            try:
                r = call.get(timeout=0)
            except TimeoutError:
                continue
            except Exception as e:  # noqa: BLE001 - record the failure and keep the others
                r = {"gpu": g, "error": repr(e)[:300]}
            if "wall_start" in r:
                r["cold_start_s"] = r["wall_start"] - t0  # spawn -> function body starts (queue + boot + image)
            results[g] = r
            del pending[g]
            Path(out).write_text(json.dumps(list(results.values()), indent=1))
            print(json.dumps({k: r.get(k) for k in ("gpu", "device", "cold_start_s", "in_container_s", "error")}),
                  flush=True)
        time.sleep(5)
    for g, call in pending.items():
        call.cancel()
        results[g] = {"gpu": g, "error": f"not scheduled within {deadline_s} s; cancelled"}
        print(json.dumps(results[g]), flush=True)
    Path(out).write_text(json.dumps(list(results.values()), indent=1))
    print(f"wrote {out}")
