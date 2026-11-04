"""Probe: read quote photos with Muse Glimmer through Hugging Face Inference Providers.

Runs on a CPU-only Modal function (HF token from the `huggingface` secret),
sends invented fixture images only, and scores each result with the same
normalize.py and truth files as eval.py.
    modal run cloud/quote_reader/hf_probe.py [--providers together,deepinfra] [--n 6]
"""

import base64
import json
import time
from pathlib import Path

import modal

HERE = Path(__file__).parent
app = modal.App("lowkey-hf-probe")
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("requests", "pydantic>=2")
    .add_local_file(str(HERE / "schema.py"), "/root/schema.py")
    .add_local_file(str(HERE / "normalize.py"), "/root/normalize.py")
)
MODEL = "meta-models/Muse-Glimmer-30B"
KEYS = [
    "vin",
    "year",
    "selling_price",
    "msrp",
    "down",
    "out_the_door",
    "apr",
    "term_months",
    "stated_monthly",
    "amount_financed",
]


def _close(a, b):
    if a is None or b is None:
        return a == b
    if isinstance(a, str) or isinstance(b, str):
        return str(a).strip().lower() == str(b).strip().lower()
    return abs(float(a) - float(b)) < 0.005


@app.function(image=image, secrets=[modal.Secret.from_name("huggingface")], timeout=1800)
def probe(provider: str, prompt: str, fixtures: list[dict]) -> list[dict]:
    import os
    import sys

    import requests

    sys.path.insert(0, "/root")
    from normalize import normalize
    from schema import RawRead

    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    rows = []
    for fx in fixtures:
        body = {
            "model": f"{MODEL}:{provider}",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{fx['b64']}"}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "RawRead", "schema": RawRead.model_json_schema(), "strict": True},
            },
            "temperature": 0,
            "max_tokens": 6000,
        }
        t = time.time()
        try:
            r = requests.post(
                "https://router.huggingface.co/v1/chat/completions",
                headers={"Authorization": f"Bearer {token}"},
                json=body,
                timeout=300,
            )
            dt = time.time() - t
            if r.status_code != 200:
                rows.append(
                    {"name": fx["name"], "s": round(dt, 1), "error": f"HTTP {r.status_code}: {r.text[:300]}"}
                )
                continue
            data = r.json()
            content = data["choices"][0]["message"]["content"]
            usage = data.get("usage") or {}
            try:
                raw = json.loads(RawRead.model_validate_json(content).model_dump_json())
            except Exception as e:  # noqa: BLE001
                rows.append(
                    {
                        "name": fx["name"],
                        "s": round(dt, 1),
                        "error": f"schema: {str(e)[:200]}",
                        "tokens": usage,
                    }
                )
                continue
            got = normalize(raw)
            truth = fx["truth"]
            misses = [k for k in KEYS if not _close(got.get(k), truth.get(k))]
            rows.append(
                {
                    "name": fx["name"],
                    "s": round(dt, 1),
                    "misses": misses,
                    "tokens": usage.get("completion_tokens"),
                }
            )
        except Exception as e:  # noqa: BLE001
            rows.append(
                {
                    "name": fx["name"],
                    "s": round(time.time() - t, 1),
                    "error": f"{type(e).__name__}: {str(e)[:200]}",
                }
            )
    return rows


@app.local_entrypoint()
def main(providers: str = "together,deepinfra,featherless-ai", n: int = 6, kind: str = "photo"):
    import re

    src = (HERE / "serve.py").read_text()
    prompt = eval(re.search(r"\nPROMPT = (\(.*?\n\))", src, re.S).group(1))  # the reader's exact prompt
    root = Path("~/.cache/low-key/quote-fixtures").expanduser()
    suffix = ".photo.jpg" if kind == "photo" else ".png"
    names = sorted(p.name[: -len(suffix)] for p in root.glob(f"*{suffix}"))
    # a spread across document types
    picked = [x for x in names if x.startswith("buyers")][: n // 2] + [
        x for x in names if not x.startswith("buyers")
    ][: n - n // 2]
    fixtures = [
        {
            "name": x,
            "b64": base64.b64encode((root / f"{x}{suffix}").read_bytes()).decode(),
            "truth": json.loads((root / f"{x}.truth.json").read_text()),
        }
        for x in picked
    ]
    for provider, rows in zip(
        providers.split(","),
        probe.map(providers.split(","), kwargs={"prompt": prompt, "fixtures": fixtures}),
        strict=True,
    ):
        print(f"=== {provider}")
        for r in rows:
            print("  ", json.dumps(r)[:400])
