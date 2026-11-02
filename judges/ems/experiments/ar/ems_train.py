"""Blue-loop training script (FULL and BLUE_ONLY arms edit this). Runs on a Modal H100 via `emslearn.cli train`.

Trains the candidate's option scorer (an MLP over the features of emslearn.policy) on rollout shards:
- labelled decisions: listwise cross-entropy toward softmax(-delta / tau) over the valid options (counterfactual
  labels; delta < 0 is better than the logged choice);
- every decision: imitation of the logged choice, weighted by `imitate` (keeps unlabelled behaviour close to the
  policy that generated the data).
Whole dataset resident in GPU memory, torch.compile with a fixed batch shape, bf16 autocast, checkpoint each epoch.
Writes the weights as w0, b0, w1, b1, ... (numpy, float32) for CPU inference in the simulator.
"""

from __future__ import annotations

import argparse
import glob
import json
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

DEFAULTS = {"hidden": [64, 64], "epochs": 20, "batch": 4096, "lr": 3e-3, "tau": 1.0, "imitate": 3.0,
            "gain_min": 0.5, "gate_gain": 25.0, "gate_k": 25.0, "seed": 0}


def load(data: str):
    files = sorted(glob.glob(f"{data}/*.npz"))
    parts = [np.load(f) for f in files]
    X = np.concatenate([p["X"] for p in parts])
    return (torch.from_numpy(X), torch.from_numpy(np.concatenate([p["mask"] for p in parts])),
            torch.from_numpy(np.concatenate([p["delta"] for p in parts])),
            torch.from_numpy(np.concatenate([p["choice"] for p in parts]).astype(np.int64)), len(files))


def model(features: int, hidden: list[int]) -> nn.Sequential:
    layers, d = [], features
    for h in hidden:
        layers += [nn.Linear(d, h), nn.ReLU()]
        d = h
    return nn.Sequential(*layers, nn.Linear(d, 1))


def export(net: nn.Sequential, path: str) -> None:
    lin = [m for m in net if isinstance(m, nn.Linear)]
    arrays = {}
    for i, m in enumerate(lin):
        arrays[f"w{i}"] = m.weight.detach().float().cpu().numpy().T
        arrays[f"b{i}"] = m.bias.detach().float().cpu().numpy()
    np.savez(path, **arrays)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--init")
    ap.add_argument("--args", default="{}")
    a = ap.parse_args()
    cfg = {**DEFAULTS, **json.loads(a.args)}
    torch.manual_seed(cfg["seed"])
    torch.backends.cuda.matmul.allow_tf32 = True
    dev = "cuda"
    t0 = time.time()
    X, mask, delta, choice = load(a.data)[:4]
    X, mask, delta, choice = X.to(dev), mask.to(dev), delta.to(dev), choice.to(dev)
    labelled = ~torch.isnan(delta).all(1)
    gain = delta.gather(1, choice[:, None]) - delta  # > 0 where an option beats the logged choice
    best_gain = torch.where(mask & ~torch.isnan(delta), gain,
                            torch.tensor(float("-inf"), device=dev)).max(1).values
    labelled = labelled & (best_gain > cfg["gain_min"])  # flat labels only add noise toward uniform
    gate = torch.where(best_gain > cfg["gate_gain"],  # clone b1 except where a label shows a big win
                       torch.exp(-(best_gain - cfg["gate_gain"]) / cfg["gate_k"]),
                       torch.ones((), device=dev))
    target = torch.softmax(torch.where(mask & ~torch.isnan(delta), -delta / cfg["tau"], torch.tensor(-1e9, device=dev)), 1)
    target = torch.where(labelled[:, None], target, torch.zeros_like(target))
    n, o, f = X.shape
    print(json.dumps({"decisions": n, "labelled": int(labelled.sum()), "options": o, "features": f,
                      "load_s": round(time.time() - t0, 1)}), flush=True)
    bg = best_gain[labelled].float().cpu()  # A2: unit-only gains; diagnostic for gate calibration
    q = torch.quantile(bg, torch.tensor([0.5, 0.75, 0.9, 0.99])) if len(bg) else torch.zeros(4)
    print(json.dumps({"gain_q": [round(float(x), 2) for x in q],
                      "gain_max": round(float(bg.max()) if len(bg) else 0.0, 2),
                      "n_gt25": int((bg > 25).sum()), "n_gt100": int((bg > 100).sum())}), flush=True)
    net = model(f, cfg["hidden"]).to(dev)
    ck = Path(a.ckpt) / "state.pt"
    start = 0
    if ck.exists():  # resume after preemption
        st = torch.load(ck, map_location=dev)
        net.load_state_dict(st["net"])
        start = st["epoch"] + 1
    opt = torch.optim.AdamW(net.parameters(), lr=cfg["lr"], fused=True)
    if ck.exists():
        opt.load_state_dict(torch.load(ck, map_location=dev)["opt"])
    fwd = torch.compile(net, dynamic=False)
    b = min(cfg["batch"], n)

    def step(idx):
        with torch.autocast("cuda", dtype=torch.bfloat16):
            s = fwd(X[idx].reshape(-1, f)).reshape(len(idx), o).float()
        s = s.masked_fill(~mask[idx], -1e9)
        logp = torch.log_softmax(s, 1)
        lab = labelled[idx]
        loss_l = -(target[idx] * logp).sum(1)
        loss_i = -logp.gather(1, choice[idx][:, None])[:, 0]
        loss = (loss_l * lab).sum() / lab.sum().clamp(min=1) + cfg["imitate"] * (gate[idx] * loss_i).mean()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
        return loss.detach()

    for ep in range(start, cfg["epochs"]):
        perm = torch.randperm(n, device=dev)
        losses = [step(perm[i:i + b]) for i in range(0, n - b + 1, b)]
        torch.save({"net": net.state_dict(), "opt": opt.state_dict(), "epoch": ep}, ck)
        print(json.dumps({"epoch": ep, "loss": round(float(torch.stack(losses).mean()), 4),
                          "elapsed_s": round(time.time() - t0, 1)}), flush=True)
    export(net, a.out)
    ck.unlink(missing_ok=True)
    print(json.dumps({"done": True, "seconds": round(time.time() - t0, 1)}))


if __name__ == "__main__":
    main()
