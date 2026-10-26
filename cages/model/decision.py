"""Predict-and-decide decision model: one deterministic forward pass scores every car.

Observable feature tokens (global, floors, cars) are projected into the backbone's hidden size and
fed as ``inputs_embeds``.  The car tokens come last, so causal (decoder) backbones such as a
decapitated Muse Glimmer still let every car token attend to the whole building state.  A small
value head maps each car token to a score; softmax over the valid cars gives a calibrated decision
distribution (trained with a strictly proper scoring rule, see ``train.py``).

Backbones:
* ``scratch``  - a small bidirectional transformer trained from scratch (the 20M control);
* ``hf:<path>`` - any Hugging Face trunk loadable with ``AutoModel`` (decapitated Muse Glimmer,
  Laya's ModernBERT encoder, ...).
"""

from __future__ import annotations

import torch
from torch import nn


class ScratchBackbone(nn.Module):
    def __init__(self, d_model: int = 256, n_layers: int = 6, n_heads: int = 8, dropout: float = 0.1):
        super().__init__()
        layer = nn.TransformerEncoderLayer(d_model, n_heads, 4 * d_model, dropout, batch_first=True, norm_first=True)
        self.enc = nn.TransformerEncoder(layer, n_layers, enable_nested_tensor=False)
        self.hidden_size = d_model

    def forward(self, x, mask=None):
        return self.enc(x, src_key_padding_mask=mask)


class HFBackbone(nn.Module):
    """A decapitated Hugging Face trunk (no LM head), driven through ``inputs_embeds``."""

    LORA_TARGETS = ("q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj", "Wqkv", "Wo", "Wi")

    def __init__(self, path: str, dtype: str = "float32", freeze: bool = False, lora_rank: int = 0,
                 quant: str = "none"):
        super().__init__()
        from transformers import AutoModel

        kw = {"dtype": getattr(torch, dtype)}
        if quant == "nf4":  # 4-bit weights for edge GPUs (bitsandbytes, CUDA only)
            from transformers import BitsAndBytesConfig

            kw["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                                           bnb_4bit_compute_dtype=torch.bfloat16)
        self.model = AutoModel.from_pretrained(path, **kw)
        self.hidden_size = int(self.model.config.hidden_size)
        if freeze or lora_rank > 0:
            for p in self.model.parameters():
                p.requires_grad_(False)
        if lora_rank > 0:
            from peft import LoraConfig, get_peft_model

            names = {n.split(".")[-1] for n, _ in self.model.named_modules()}
            targets = [t for t in self.LORA_TARGETS if t in names]
            self.model = get_peft_model(self.model, LoraConfig(r=lora_rank, lora_alpha=2 * lora_rank,
                                                               target_modules=targets, lora_dropout=0.05))

    def forward(self, x, mask=None):
        attn = None if mask is None else (~mask).long()
        out = self.model(inputs_embeds=x.to(self.model.dtype), attention_mask=attn)
        return out.last_hidden_state.float()


class DecisionModel(nn.Module):
    def __init__(self, car_dim: int, floor_dim: int, glob_dim: int, n_floors: int, n_cars: int,
                 backbone: str = "scratch", d_model: int = 256, n_layers: int = 6, hf_dtype: str = "float32",
                 lora_rank: int = 0, quant: str = "none"):
        super().__init__()
        if backbone == "scratch":
            self.backbone = ScratchBackbone(d_model, n_layers)
        elif backbone.startswith("hf:"):
            self.backbone = HFBackbone(backbone[3:], hf_dtype, lora_rank=lora_rank, quant=quant)
        else:
            raise ValueError(backbone)
        h = self.backbone.hidden_size
        self.config = dict(car_dim=car_dim, floor_dim=floor_dim, glob_dim=glob_dim, n_floors=n_floors,
                           n_cars=n_cars, backbone=backbone, d_model=d_model, n_layers=n_layers, lora_rank=lora_rank)
        self.car_in = nn.Sequential(nn.Linear(car_dim, h), nn.GELU(), nn.Linear(h, h))
        self.floor_in = nn.Sequential(nn.Linear(floor_dim, h), nn.GELU(), nn.Linear(h, h))
        self.glob_in = nn.Sequential(nn.Linear(glob_dim, h), nn.GELU(), nn.Linear(h, h))
        self.floor_pos = nn.Embedding(n_floors, h)
        self.car_pos = nn.Embedding(n_cars, h)
        self.type_emb = nn.Embedding(3, h)
        self.head = nn.Sequential(nn.LayerNorm(h), nn.Linear(h, h // 2), nn.GELU(), nn.Linear(h // 2, 1))
        self.log_temp = nn.Parameter(torch.zeros(()), requires_grad=False)  # post-hoc calibration
        for m in (self.car_in, self.floor_in, self.glob_in):
            nn.init.normal_(m[-1].weight, std=0.02)

    def forward(self, car, floor, glob, mask):
        """car (B,C,Fc), floor (B,F,Ff), glob (B,Fg), mask (B,C) True=valid -> logits (B,C)."""
        B, C, _ = car.shape
        F = floor.shape[1]
        dev = car.device
        g = self.glob_in(glob)[:, None] + self.type_emb.weight[0]
        f = self.floor_in(floor) + self.floor_pos(torch.arange(F, device=dev)) + self.type_emb.weight[1]
        c = self.car_in(car) + self.car_pos(torch.arange(C, device=dev)) + self.type_emb.weight[2]
        x = torch.cat([g, f, c], dim=1)
        pad = torch.zeros(B, 1 + F, dtype=torch.bool, device=dev)
        key_pad = torch.cat([pad, ~mask], dim=1)
        hdn = self.backbone(x, key_pad)
        logits = self.head(hdn[:, 1 + F:]).squeeze(-1) / self.log_temp.exp()
        return logits.masked_fill(~mask, -1e9)

    @torch.no_grad()
    def decide(self, car, floor, glob, mask):
        """Deterministic decision + calibrated confidence for a single state (numpy in/out)."""
        t = lambda a, dt=torch.float32: torch.as_tensor(a, dtype=dt)[None]  # noqa: E731
        logits = self(t(car), t(floor), t(glob), t(mask, torch.bool))[0]
        p = torch.softmax(logits, -1)
        a = int(torch.argmax(p))
        return a, float(p[a]), p.numpy()


def count_params(m: nn.Module) -> int:
    return int(sum(p.numel() for p in m.parameters()))
