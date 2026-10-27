import json
from pathlib import Path

import numpy as np
import pytest
import torch

transformers = pytest.importorskip("transformers")

from cages.model.decapitate import decapitate  # noqa: E402
from cages.model.decision import DecisionModel  # noqa: E402
from cages.model.train import ece, regret, soft_targets  # noqa: E402


def _tiny_glimmer(tmp_path):
    from transformers.models.muse_glimmer import MuseGlimmerConfig, MuseGlimmerForConditionalGeneration

    tc = dict(vocab_size=64, hidden_size=32, intermediate_size=64, num_hidden_layers=4, num_attention_heads=4,
              num_key_value_heads=2, head_dim=8, max_position_embeddings=256, sliding_window=16,
              eos_token_id=1, bos_token_id=0)
    vc = dict(hidden_size=16, intermediate_size=32, num_hidden_layers=1, num_attention_heads=2)
    torch.manual_seed(0)
    m = MuseGlimmerForConditionalGeneration(MuseGlimmerConfig(text_config=tc, vision_config=vc))
    src = tmp_path / "glimmer-tiny"
    m.save_pretrained(src)
    return m, src


def test_decapitate_truncates_glimmer_and_drops_head(tmp_path):
    full, src = _tiny_glimmer(tmp_path)
    out = tmp_path / "trunk"
    meta = decapitate(str(src), str(out), keep_layers=2, dtype="float32")
    assert meta["original_layers"] == 4 and meta["kept_layers"] == 2
    meta2 = json.loads((out / "decapitation.json").read_text())
    assert meta2["kept_layers"] == 2
    from transformers import AutoModel

    trunk = AutoModel.from_pretrained(out)
    names = [n for n, _ in trunk.named_parameters()]
    assert not any("lm_head" in n or "vision" in n for n in names)
    assert not any(n.startswith("layers.2.") or n.startswith("layers.3.") for n in names)
    ref = full.state_dict()["model.language_model.layers.1.mlp.down_proj.weight"]
    assert torch.equal(trunk.state_dict()["layers.1.mlp.down_proj.weight"], ref)
    h = trunk(inputs_embeds=torch.randn(2, 7, 32)).last_hidden_state
    assert h.shape == (2, 7, 32) and torch.isfinite(h).all()


def _batch(B=3, C=6, F=30):
    from cages.data.features import N_FLOOR, N_GLOBAL, car_dim

    g = torch.Generator().manual_seed(0)
    car = torch.randn(B, C, car_dim(F), generator=g)
    floor = torch.randn(B, F, N_FLOOR, generator=g)
    glob = torch.randn(B, N_GLOBAL, generator=g)
    mask = torch.ones(B, C, dtype=torch.bool)
    mask[0, 2] = False
    return car, floor, glob, mask


def test_decision_model_scratch_scores_every_car_once():
    car, floor, glob, mask = _batch()
    m = DecisionModel(car.shape[-1], floor.shape[-1], glob.shape[-1], 30, 6, "scratch", 64, 2)
    m.eval()
    logits = m(car, floor, glob, mask)
    assert logits.shape == (3, 6)
    assert logits[0, 2] < -1e8  # masked car never chosen
    a, conf, p = m.decide(car[0].numpy(), floor[0].numpy(), glob[0].numpy(), mask[0].numpy())
    assert a != 2 and 0 < conf <= 1 and abs(p.sum() - 1) < 1e-5
    a2, conf2, _ = m.decide(car[0].numpy(), floor[0].numpy(), glob[0].numpy(), mask[0].numpy())
    assert (a, conf) == (a2, conf2)  # deterministic


def test_decision_model_on_decapitated_glimmer_trunk(tmp_path):
    _, src = _tiny_glimmer(tmp_path)
    out = tmp_path / "trunk"
    decapitate(str(src), str(out), keep_layers=2, dtype="float32")
    car, floor, glob, mask = _batch()
    m = DecisionModel(car.shape[-1], floor.shape[-1], glob.shape[-1], 30, 6, f"hf:{out}")
    logits = m(car, floor, glob, mask)
    loss = -torch.log_softmax(logits, -1)[:, 0].mean()
    loss.backward()
    assert m.car_in[0].weight.grad is not None and torch.isfinite(logits[mask]).all()


def test_soft_targets_and_metrics():
    q = np.array([[10.0, 10.1, 20.0], [5.0, 9.0, 9.0]])
    s = np.array([[0.5, 0.5, 0.5], [0.1, 0.1, 0.1]])
    p = soft_targets(q, s)
    assert np.allclose(p.sum(1), 1) and p[0, 0] > p[0, 1] > p[0, 2] and p[1, 0] > 0.99
    assert regret(q, np.array([0, 0])) == 0.0
    assert ece(np.array([1.0, 1.0]), np.array([1.0, 1.0])) == 0.0


def test_lora_on_decapitated_glimmer(tmp_path):
    pytest.importorskip("peft")
    _, src = _tiny_glimmer(tmp_path)
    out = tmp_path / "trunk"
    decapitate(str(src), str(out), keep_layers=2, dtype="float32")
    car, floor, glob, mask = _batch()
    m = DecisionModel(car.shape[-1], floor.shape[-1], glob.shape[-1], 30, 6, f"hf:{out}", lora_rank=4)
    trainable = [n for n, p in m.backbone.named_parameters() if p.requires_grad]
    assert trainable and all("lora_" in n for n in trainable)
    m(car, floor, glob, mask).sum().backward()


def test_adapter_checkpoint_roundtrip(tmp_path):
    pytest.importorskip("peft")
    from cages.model.train import load_model, save_checkpoint

    _, src = _tiny_glimmer(tmp_path)
    out = tmp_path / "trunk"
    decapitate(str(src), str(out), keep_layers=2, dtype="float32")
    car, floor, glob, mask = _batch()
    m = DecisionModel(car.shape[-1], floor.shape[-1], glob.shape[-1], 30, 6, f"hf:{out}", lora_rank=4)
    with torch.no_grad():
        for n, p in m.backbone.named_parameters():
            if "lora_B" in n:
                p.normal_(0, 0.1)  # make adapters non-trivial
    m.eval()
    ref = m(car, floor, glob, mask)
    save_checkpoint(m, str(tmp_path / "ck"))
    ck = torch.load(tmp_path / "ck" / "decision_model.pt", weights_only=False)
    assert "head_state" in ck and ck["lora_state"] and not any(k.startswith("backbone.") for k in ck["head_state"])
    m2 = load_model(str(tmp_path / "ck"))
    assert torch.allclose(m2(car, floor, glob, mask), ref, atol=1e-5)


def test_load_model_uses_trained_precision_and_reuses_the_model(tmp_path):
    from cages.model.train import load_model, save_checkpoint, trained_quant

    car, floor, glob, _ = _batch()
    save_checkpoint(DecisionModel(car.shape[-1], floor.shape[-1], glob.shape[-1], 30, 6, "scratch", 32, 1),
                    str(tmp_path))
    assert torch.load(tmp_path / "decision_model.pt", weights_only=False)["config"]["quant"] == "none"
    assert load_model(str(tmp_path)) is load_model(str(tmp_path))  # one load per evaluator worker
    # checkpoints saved before the config recorded it: the precision comes from metrics.json
    (tmp_path / "metrics.json").write_text(json.dumps({"final": {"quant": "nf4"}}))
    assert trained_quant(str(tmp_path), {}) == "nf4"


def test_scratch_training_runs_on_available_device(tmp_path):
    from cages.model.train import train

    data = Path(__file__).resolve().parents[1] / "datasets" / "cages-v0-mini"
    if not (data / "train" / "shard-000.npz").exists():
        pytest.skip("CAGES v0-mini not present")
    final = train(str(data), str(tmp_path / "run"), epochs=1, d_model=32, n_layers=1, batch=256)
    assert final["epochs_run"] == 1 and 0 <= final["dev"]["top1"] <= 1
