"""Train the decision model on CAGES counterfactual labels.

Targets are soft: p*(a) = softmax(-(Q(a) - min Q) / s), where s is the CRN noise scale of that
state, so near-ties stay uncertain.  The loss is the log score (cross-entropy), a strictly proper
scoring rule -- the calibrated-decision principle behind RLCD (Laya).  Post-hoc temperature scaling
on dev sharpens calibration.  Metrics: top-1 agreement with the counterfactual best, regret
relative to the best action, and expected calibration error (ECE).

    python -m cages.model.train --data datasets/cages-v0-mini --backbone scratch --epochs 30
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
from torch.nn import functional as F

from .decision import DecisionModel, count_params


def load_split(root: str, split: str) -> dict:
    d = np.load(Path(root) / split / "shard-000.npz", allow_pickle=False)
    return {k: d[k] for k in d.files}


def soft_targets(q_mean: np.ndarray, q_std: np.ndarray, floor_frac: float = 0.005) -> np.ndarray:
    adv = q_mean - q_mean.min(axis=1, keepdims=True)
    scale = np.maximum(np.median(q_std, axis=1, keepdims=True), floor_frac * q_mean.mean(axis=1, keepdims=True))
    z = -adv / np.maximum(scale, 1e-6)
    z -= z.max(axis=1, keepdims=True)
    p = np.exp(z)
    return p / p.sum(axis=1, keepdims=True)


def to_tensors(d: dict) -> dict:
    return {
        "car": torch.tensor(d["car"], dtype=torch.float32), "floor": torch.tensor(d["floor"], dtype=torch.float32),
        "glob": torch.tensor(d["glob"], dtype=torch.float32), "mask": torch.tensor(d["mask"], dtype=torch.bool),
        "target": torch.tensor(soft_targets(d["q_mean"], d["q_std"]), dtype=torch.float32),
        "q": torch.tensor(d["q_mean"], dtype=torch.float32),
    }


def ece(conf: np.ndarray, correct: np.ndarray, bins: int = 10) -> float:
    edges = np.linspace(0, 1, bins + 1)
    e = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            e += m.mean() * abs(conf[m].mean() - correct[m].mean())
    return float(e)


def regret(q: np.ndarray, choice: np.ndarray) -> float:
    """Mean relative regret: (Q[choice] - min Q) / mean Q."""
    qc = q[np.arange(len(q)), choice]
    return float(np.mean((qc - q.min(1)) / q.mean(1)))


@torch.no_grad()
def evaluate(model: DecisionModel, t: dict, raw: dict, batch: int = 256) -> dict:
    model.eval()
    logits = torch.cat([
        model(t["car"][i:i + batch], t["floor"][i:i + batch], t["glob"][i:i + batch], t["mask"][i:i + batch])
        for i in range(0, len(t["car"]), batch)
    ])
    p = torch.softmax(logits, -1).numpy()
    choice = p.argmax(1)
    q = raw["q_mean"]
    best = q.argmin(1)
    target = t["target"].numpy()
    nll = float(-(target * np.log(np.clip(p, 1e-9, 1))).sum(1).mean())
    return {
        "n": int(len(q)),
        "top1": float((choice == best).mean()),
        "regret": regret(q, choice),
        "regret_esa": regret(q, raw["esa_choice"]),
        "regret_eta": regret(q, raw["eta_choice"]),
        "regret_random": float(np.mean((q.mean(1) - q.min(1)) / q.mean(1))),
        "top1_esa": float((raw["esa_choice"] == best).mean()),
        "ece": ece(p.max(1), (choice == best).astype(float)),
        "log_score": nll,
    }


def fit_temperature(model: DecisionModel, t: dict) -> float:
    with torch.no_grad():
        model.log_temp.zero_()
        logits = model(t["car"], t["floor"], t["glob"], t["mask"])
    best_T, best_nll = 1.0, float("inf")
    for T in np.exp(np.linspace(np.log(0.25), np.log(8.0), 41)):
        nll = float(-(t["target"] * torch.log_softmax(logits / T, -1)).sum(-1).mean())
        if nll < best_nll:
            best_T, best_nll = float(T), nll
    model.log_temp.fill_(float(np.log(best_T)))
    return best_T


def train(data: str, out: str, backbone: str = "scratch", epochs: int = 30, lr: float = 3e-4, batch: int = 64,
          d_model: int = 128, n_layers: int = 4, seed: int = 0, max_minutes: float = 1e9, hf_dtype: str = "float32",
          lora_rank: int = 0) -> dict:
    torch.manual_seed(seed)
    tr_raw, dv_raw = load_split(data, "train"), load_split(data, "dev")
    tr, dv = to_tensors(tr_raw), to_tensors(dv_raw)
    _, C, Fc = tr["car"].shape
    Fl, Ff = tr["floor"].shape[1:]
    model = DecisionModel(Fc, Ff, tr["glob"].shape[1], Fl, C, backbone, d_model, n_layers, hf_dtype, lora_rank)
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=lr, weight_decay=0.01)
    n = len(tr["car"])
    t0 = time.time()
    history = []
    for ep in range(epochs):
        model.train()
        perm = torch.randperm(n)
        tot = 0.0
        for i in range(0, n, batch):
            idx = perm[i:i + batch]
            logits = model(tr["car"][idx], tr["floor"][idx], tr["glob"][idx], tr["mask"][idx])
            loss = -(tr["target"][idx] * F.log_softmax(logits, -1)).sum(-1).mean()
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            tot += float(loss.detach()) * len(idx)
        dev = evaluate(model, dv, dv_raw)
        history.append({"epoch": ep, "train_log_score": tot / n, **{f"dev_{k}": v for k, v in dev.items()}})
        if (time.time() - t0) / 60 > max_minutes:
            break
    T = fit_temperature(model, dv)
    final = {"train": evaluate(model, tr, tr_raw), "dev": evaluate(model, dv, dv_raw), "temperature": T,
             "params": count_params(model), "backbone": backbone, "epochs_run": len(history),
             "minutes": round((time.time() - t0) / 60, 2)}
    outp = Path(out)
    outp.mkdir(parents=True, exist_ok=True)
    torch.save({"config": model.config, "state_dict": model.state_dict()}, outp / "decision_model.pt")
    (outp / "metrics.json").write_text(json.dumps({"final": final, "history": history}, indent=1))
    return final


def load_model(path: str, quant: str = "none") -> DecisionModel:
    ck = torch.load(Path(path) / "decision_model.pt", map_location="cpu", weights_only=False)
    c = ck["config"]
    m = DecisionModel(c["car_dim"], c["floor_dim"], c["glob_dim"], c["n_floors"], c["n_cars"], c["backbone"],
                      c["d_model"], c["n_layers"], lora_rank=c.get("lora_rank", 0), quant=quant)
    m.load_state_dict(ck["state_dict"])
    m.eval()
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="datasets/cages-v0-mini")
    ap.add_argument("--out", default="runs/decision-scratch")
    ap.add_argument("--backbone", default="scratch")
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--d-model", type=int, default=128)
    ap.add_argument("--n-layers", type=int, default=4)
    ap.add_argument("--max-minutes", type=float, default=1e9)
    ap.add_argument("--hf-dtype", default="float32")
    ap.add_argument("--lora-rank", type=int, default=0)
    a = ap.parse_args()
    print(json.dumps(train(a.data, a.out, a.backbone, a.epochs, a.lr, a.batch, a.d_model, a.n_layers,
                           max_minutes=a.max_minutes, hf_dtype=a.hf_dtype, lora_rank=a.lora_rank), indent=1))


if __name__ == "__main__":
    main()
