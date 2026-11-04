"""Probe: does a GPU memory snapshot cut the reader's cold start? (task 051)

Status 2026-11-04: not yet measured (the first deploy failed on an import;
fixed). A separate app, so the live reader is never touched:
    modal deploy cloud/quote_reader/snap_probe.py
    python cloud/quote_reader/snap_probe.py      # times warm() on fresh containers

The snapshot phase loads Glimmer with vLLM sleep mode, runs one warm-up
generation (so compiled kernels and CUDA graphs exist), then sleeps the
engine (weights to CPU, KV cache freed) before Modal snapshots the
container. A restored container only wakes the engine.
"""

import time

import modal

# Defined here, not imported from serve.py: the probe's container only has this file.
MODEL_DIR = "/models/meta-models__Muse-Glimmer-30B"
vol = modal.Volume.from_name("lowkey-quote-models")
cache = modal.Volume.from_name("lowkey-quote-vllm-cache")

app = modal.App("lowkey-quote-reader-snap")
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("vllm==0.32.0", "pillow")
    .env(
        {
            "HF_HUB_OFFLINE": "1",
            "VLLM_USE_FLASHINFER_SAMPLER": "0",
            "TORCHINDUCTOR_COMPILE_THREADS": "1",  # snapshot-friendly compile
            "VLLM_SERVER_DEV_MODE": "1",
        }
    )
)


@app.cls(
    image=image,
    gpu="H100",
    volumes={"/models": vol, "/root/.cache/vllm": cache},
    enable_memory_snapshot=True,
    experimental_options={"enable_gpu_snapshot": True},
    min_containers=0,
    max_containers=1,
    scaledown_window=60,
    timeout=20 * 60,
)
class SnapReader:
    @modal.enter(snap=True)
    def load(self):
        from vllm import LLM, SamplingParams

        t = time.time()
        self.llm = LLM(
            model=MODEL_DIR,
            max_model_len=16384,
            max_num_seqs=2,
            limit_mm_per_prompt={"image": 1},
            gpu_memory_utilization=0.90,
            compilation_config={"cudagraph_capture_sizes": [1, 2, 4]},
            enable_sleep_mode=True,
        )
        self.llm.generate(["Say ready."], SamplingParams(max_tokens=4))
        self.llm.sleep(level=1)
        print(f"snapshot phase: load+warmup+sleep {time.time() - t:.1f}s")

    @modal.enter(snap=False)
    def wake(self):
        t = time.time()
        self.llm.wake_up()
        print(f"restore phase: wake_up {time.time() - t:.1f}s")

    @modal.method()
    def warm(self) -> str:
        from vllm import SamplingParams

        out = self.llm.generate(["Say ready."], SamplingParams(max_tokens=4))[0].outputs[0].text
        return out.strip() or "ready"


if __name__ == "__main__":
    cls = modal.Cls.from_name("lowkey-quote-reader-snap", "SnapReader")
    for i in range(2):
        t = time.time()
        print(f"call {i + 1}: {cls().warm.remote()!r} in {time.time() - t:.1f}s")
        if i == 0:
            print("waiting 150 s for the container to scale down…")
            time.sleep(150)
