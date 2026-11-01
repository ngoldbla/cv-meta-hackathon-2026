# M5 compute on Modal: design (2026-11-01)

**Goal:** run the M5 blue loops' GPU work on Modal at the lowest cost per unit of training, with no GPU-second spent waiting on anything else.

**Program context:**
- Program spec §11 sets 40 blue iterations per arm and a $200 cloud cap. The arms are FULL, BLUE_ONLY and NO_CF, which train models; READABLE trains none.
- The judge (CPU simulator) is frozen and stays local.

## 1. Measured GPU bake-off (`cloud/modal_gpu_bench.py`, results in `cloud/gpu_bakeoff_2026-11-01.json`)

**Workload:** a proxy for the learned dispatch policy. It is a set-transformer over 64 call tokens and 512 unit tokens, scoring every (call, unit) assignment, with cross-entropy loss, bf16 autocast, TF32 and fused AdamW. There are three sizes:

| Size | d_model | Layers | Params |
|---|---|---|---|
| S | 128 | 2 | 0.4M |
| M | 256 | 4 | 3.3M |
| L | 512 | 8 | 25.8M |

**Setup:** one container per GPU type, all in parallel, using PyTorch 2.15.0+cu132 on the Modal host driver (CUDA 13.3). Each run swept eager batch sizes, then compiled `torch.compile(dynamic=False)` at the best batch. The bake-off cost $1.13 (an earlier interrupted attempt cost $1.08).

| GPU | $/h | Compiled samples/s (S / M / L) | Samples per $ (M) | Samples per $ (L) | Proxy run, M, 2M samples | Proxy run, L |
|---|---|---|---|---|---|---|
| H100 | 3.95 | 35,863 / 12,432 / 3,282 | 11.3M | 3.0M | 2.9 min, $0.19 | 10.5 min, $0.69 |
| H200 | 4.54 | 41,010 / 14,353 / 3,551 | 11.4M | 2.8M | 2.6 min, $0.20 | 9.7 min, $0.74 |
| RTX PRO 6000 | 3.03 | 27,967 / 8,365 / 1,858 | 9.9M | 2.2M | 4.2 min, $0.21 | 18.2 min, $0.92 |
| A100-40GB | 2.10 | 15,562 / 5,451 / 1,256 | 9.3M | 2.2M | 6.6 min, $0.23 | 27.2 min, $0.95 |
| A100-80GB | 2.50 | 16,922 / 5,916 / 1,345 | 8.5M | 1.9M | 6.0 min, $0.25 | 25.2 min, $1.05 |
| L40S | 1.95 | 15,691 / 4,640 / 1,029 | 8.6M | 1.9M | 7.4 min, $0.24 | 32.7 min, $1.06 |
| A10 | 1.10 | 6,807 / 2,085 / 439 | 6.8M | 1.4M | 16.2 min, $0.30 | 76.4 min, $1.40 |
| L4 | 0.80 | 3,983 / 1,182 / 252 | 5.3M | 1.1M | 29.5 min, $0.39 | 134 min, $1.78 |

The run times include the measured fixed overhead: container start, torch import, CUDA init and compile.

**B200 was not measured.** The scheduler refused it: "B200 unavailable on starter plan." To match the H100 on cost per sample, it would need more than 1.58× the H100's throughput (6.25 / 3.95). The H200 reaches only 1.15× on this workload, which is too small to be bound by raw FLOPs. So the B200 would cost more per run and would need a plan upgrade.

## 2. Recommendation
- **GPU: `gpu="H100"`.** It has the lowest cost per run for M and L, and the second-fastest wall time. Modal may serve an `H100` request with an H200 **at the H100 price**, which only helps. Do not use `H100!`, which turns that upgrade off.
- **Model class: M by default.** L is allowed for proxy runs only with a per-job cap. Full trainings of kept candidates at 20M samples cost about $1.78 for M versus $6.70 for L; 30 L-class full runs alone would use the whole $200 cap.

| M5 projection (3 GPU arms × 40 iterations) | M model | L model |
|---|---|---|
| 120 proxy runs | about $23 | about $83 |
| About 30 full runs (1 kept in 4) | about $53 | about $200 (over the cap) |
| CPU label fan-out (section 3) | about $10–40 | about $10–40 |
| **Total** | **about $90–120** | **over $200** |

## 3. Rules that keep GPU-seconds from being wasted (each from a measurement or a Modal guarantee)
1. **A GPU container only trains.** It never runs the simulator, never evaluates, and never waits for the agent. One Modal function call per training job, with `scaledown_window` at the minimum. Modal bills idle time inside the scaledown window, including the GPU reservation (`guide/cold-start.md`).
2. **Training data is generated on CPU containers,** using `.map` fan-out of the simulator's counterfactual labeller. It is written once as a few large `.npy` shards to a v2 Volume, which suits write-once, read-many work. Dev evaluation stays on dylan-pc: 200 days take 30 s on 24 cores, for free.
3. **The whole dataset lives in GPU memory.** There is no DataLoader. The H100 has 80 GB; the M model at batch 2048 peaked at 35 GB.
4. **Always `torch.compile(dynamic=False)`** with fixed batch shapes. It gave 1.5–1.8× on every GPU, for 6–14 s of compile on H100-class cards, which pays back after about 30 s of training. Cache the inductor artifacts in the Volume so repeat compiles skip.
5. **No GPU memory snapshots.** Measured cold start is 3–5 s, torch import 1.4–2.3 s and CUDA init 0.2–0.5 s. Snapshots would save about 2 s, and Modal notes they can fail with `torch.compile`.
6. **Use the batch size where throughput saturates:** about 4096 (S), 2048 (M) and 1024 (L) on H100.
7. **Preemption:** GPU functions are always preemptible (`guide/preemption.md`). Checkpoint to the Volume every few minutes, and use `modal.Retries(initial_delay=0, max_retries=3)`. Resume from the last checkpoint.
8. **Build the image once and pin it:** `debian_slim` (Python 3.12) plus `torch==2.15.0`. The first build took 2.5 min on CPU; later runs pull it from cache.
9. **Avoid the L4.** It waited 58 s for capacity and is the slowest per dollar.

## 4. Spending guardrails
- **Modal workspace budget.** Dylan sets it on Usage & Billing, owner only. It is the hard outer cap that Modal itself enforces. Recommended: $200 for the billing cycle.
- **`cloud/budget.py`:** every job runs under it with its own cap. It now keeps one shared spend log in the main checkout's `runs/spend.jsonl`; it was previously relative to the working directory, so each checkout had its own ledger. It also logs even when interrupted, and `budget.py record` writes in actual costs from `modal billing report`.
- **Daily reconciliation:** compare `modal billing report --for today --show-resources` with the spend log.

## 5. What stays local
- The frozen judge, every dev evaluation, the Muse agents, and all holdout data and holdout runs (M6).
- The Volume holds only the judge code, the calibration bundle, the dev day tables (about 32 MB) and the generated training shards.
