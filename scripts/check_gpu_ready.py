"""Readiness check for the GPU machine.  Prints a JSON report; exit 0 only if the critical checks pass.

Critical: CUDA device, bf16, bitsandbytes 4-bit path (tiny Muse Glimmer trunk -> nf4 decision model),
Hugging Face access to the model repos, free disk.  Timestral is reported but not critical.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile

REPOS = {"glimmer": "meta-models/Muse-Glimmer-30B", "laya": "convaiinnovations/laya",
         "timestral": "mistralai/Timestral-28M"}


def check() -> dict:
    r: dict = {"critical_failures": []}

    def fail(msg):
        r["critical_failures"].append(msg)

    import torch

    r["torch"] = torch.__version__
    r["cuda"] = torch.cuda.is_available()
    if not r["cuda"]:
        fail("no CUDA device")
    else:
        p = torch.cuda.get_device_properties(0)
        r.update(gpu=p.name, vram_gb=round(p.total_memory / 1e9, 1), capability=f"{p.major}.{p.minor}",
                 bf16=torch.cuda.is_bf16_supported())
        x = torch.randn(512, 512, device="cuda", dtype=torch.bfloat16)
        r["bf16_matmul_ok"] = bool(torch.isfinite(x @ x).all())
    for mod in ("transformers", "peft", "bitsandbytes", "accelerate", "timestral"):
        try:
            m = __import__(mod)
            r[mod] = getattr(m, "__version__", "ok")
        except Exception as e:  # noqa: BLE001
            r[mod] = f"missing ({type(e).__name__})"
            if mod != "timestral":
                fail(f"{mod} not importable")
    try:
        import transformers.models.muse_glimmer  # noqa: F401
        r["transformers_muse_glimmer"] = True
    except Exception:
        r["transformers_muse_glimmer"] = False
        fail("transformers lacks Muse Glimmer support (upgrade transformers)")
    if r["cuda"] and not r["critical_failures"]:
        r["nf4_decision_path"] = _nf4_smoke()
        if r["nf4_decision_path"] != "ok":
            fail("4-bit decision path failed")
    try:
        from huggingface_hub import HfApi

        api = HfApi()
        r["hf_access"] = {}
        for k, repo in REPOS.items():
            try:
                info = api.model_info(repo)
                r["hf_access"][k] = {"repo": repo, "ok": True, "gated": bool(getattr(info, "gated", False))}
            except Exception as e:  # noqa: BLE001
                r["hf_access"][k] = {"repo": repo, "ok": False, "error": type(e).__name__}
                if k != "timestral":
                    fail(f"no access to {repo} (huggingface-cli login? license accepted?)")
    except Exception as e:  # noqa: BLE001
        fail(f"huggingface_hub unavailable: {e}")
    free = shutil.disk_usage(".").free / 1e9
    r["disk_free_gb"] = round(free, 1)
    if free < 80:
        fail("need >= 80 GB free for the Glimmer download and trunks")
    r["cpu_cores"] = os.cpu_count()
    return r


def _nf4_smoke() -> str:
    try:
        import torch
        from transformers.models.muse_glimmer import MuseGlimmerConfig, MuseGlimmerForConditionalGeneration

        from cages.data.features import N_GLOBAL, N_STN, N_VEH
        from cages.model.decapitate import decapitate
        from cages.model.decision import DecisionModel

        tc = dict(vocab_size=64, hidden_size=64, intermediate_size=128, num_hidden_layers=2, num_attention_heads=4,
                  num_key_value_heads=2, head_dim=16, max_position_embeddings=256, sliding_window=16,
                  eos_token_id=1, bos_token_id=0)
        vc = dict(hidden_size=16, intermediate_size=32, num_hidden_layers=1, num_attention_heads=2)
        with tempfile.TemporaryDirectory() as d:
            MuseGlimmerForConditionalGeneration(MuseGlimmerConfig(text_config=tc, vision_config=vc)).save_pretrained(d + "/src")
            decapitate(d + "/src", d + "/trunk", keep_layers=1, dtype="bfloat16")
            m = DecisionModel(N_VEH, N_STN, N_GLOBAL, 22, 8, f"hf:{d}/trunk", lora_rank=4,
                              quant="nf4").to_device("cuda")
            veh = torch.randn(2, 8, N_VEH, device="cuda")
            out = m(veh, torch.randn(2, 22, N_STN, device="cuda"), torch.randn(2, N_GLOBAL, device="cuda"),
                    torch.ones(2, 8, dtype=torch.bool, device="cuda"))
            out.sum().backward()
        return "ok"
    except Exception as e:  # noqa: BLE001
        return f"failed: {type(e).__name__}: {e}"[:300]


if __name__ == "__main__":
    rep = check()
    print(json.dumps(rep, indent=1))
    sys.exit(1 if rep["critical_failures"] else 0)
