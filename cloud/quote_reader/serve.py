"""Quote reader: Muse Glimmer-30B (tasks 047, 052).

    modal deploy cloud/quote_reader/serve.py        # idle cost: zero
    modal run   cloud/quote_reader/serve.py --image path.jpg

Reads go first to Glimmer hosted on Hugging Face Inference Providers
(always warm, billed per token to the HF account in the `huggingface`
secret). If that fails, the same read runs on our own scale-to-zero
Modal GPU, with weights prestaged in the Volume by stage.py. Both paths
use the same prompt, schema and normalize.py. The model only READS:
it returns schema-constrained JSON and nothing else. Numbers it reads
are shown to the user for confirmation; all arithmetic stays in code.
"""

import base64
import json

import modal

MODEL_DIR = "/models/meta-models__Muse-Glimmer-30B"
GPU = "H100"  # bf16 ~60 GB; try "L40S" with a quantised build later
MINUTES = 60

app = modal.App("lowkey-quote-reader")
vol = modal.Volume.from_name("lowkey-quote-models")  # read-only here
# vLLM's torch.compile cache: the first container writes it, later ones skip compiling.
cache = modal.Volume.from_name("lowkey-quote-vllm-cache", create_if_missing=True)
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("vllm==0.32.0", "pydantic>=2", "pillow", "huggingface_hub")
    .env({"HF_HUB_OFFLINE": "1", "VLLM_LOGGING_LEVEL": "WARNING", "VLLM_USE_FLASHINFER_SAMPLER": "0"})
    .add_local_file(__file__.replace("serve.py", "schema.py"), "/root/schema.py")
    .add_local_file(__file__.replace("serve.py", "normalize.py"), "/root/normalize.py")
)

# Fallback when the short read comes back thin: copy everything (slower, never empty).
FULL_PROMPT = (
    "Read this car-buying document (a window sticker, a dealer's buyer's order, "
    "a payment offer or a listing sheet). Copy every line of text into "
    "`transcript`. Then list every printed label with its printed value in "
    "`pairs`, copying both exactly (pair by meaning: on a tilted photo a value "
    "may sit on a different line than its label). Tag fee and charge lines in "
    "`fees`; the price, down payment, total, APR and term are not fees. "
    "Never calculate or guess."
)

PROMPT = (
    "Read this car-buying document (a window sticker, a dealer's buyer's order, "
    "a payment offer or a listing sheet). In `transcript`, copy top to bottom every "
    "line that has a number, price, fee, tax, rate, term, payment, the VIN, the "
    "vehicle's year and name, or the dealer; skip lists of standard features or "
    "equipment and legal fine print. Then list every printed label with its printed "
    "value in `pairs`, copying both exactly (pair by meaning: on a tilted photo a "
    "value may sit on a different line than its label). Tag fee and charge lines in "
    "`fees`; the price, down payment, total, APR and term are not fees. "
    "Never calculate or guess."
)


@app.cls(
    image=image,
    gpu=GPU,
    volumes={"/models": vol, "/root/.cache/vllm": cache},
    enable_memory_snapshot=True,  # CPU snapshot of the imports (no GPU state)
    min_containers=0,  # nothing runs, nothing costs, until summoned
    max_containers=2,  # hard ceiling on spend
    scaledown_window=2 * MINUTES,
    timeout=10 * MINUTES,
)
class Reader:
    @modal.enter(snap=True)
    def imports(self):
        # Heavy imports only; captured in the CPU memory snapshot.
        import vllm  # noqa: F401

    @modal.enter(snap=False)
    def load(self):
        from vllm import LLM

        self.llm = LLM(
            model=MODEL_DIR,
            max_model_len=16384,
            max_num_seqs=2,  # max_containers=2 and one read at a time per container
            limit_mm_per_prompt={"image": 1},
            gpu_memory_utilization=0.90,
            # Capture CUDA graphs only for the batch sizes we actually run.
            compilation_config={"cudagraph_capture_sizes": [1, 2, 4]},
        )
        cache.commit()

    @modal.method()
    def warm(self) -> str:
        return "ready"

    @modal.method()
    def read(self, image_b64: str, mime: str = "image/jpeg") -> dict:
        import sys

        sys.path.insert(0, "/root")
        from normalize import normalize
        from schema import RawRead
        from vllm import SamplingParams
        from vllm.sampling_params import StructuredOutputsParams

        params = SamplingParams(
            temperature=0.0,
            max_tokens=6000,  # a full window sticker transcript runs past 1,500 tokens
            structured_outputs=StructuredOutputsParams(json=RawRead.model_json_schema()),
        )

        def run(prompt: str) -> dict:
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ]
            gen = self.llm.chat(messages, params)[0].outputs[0]
            # Length and stop reason only; never the page's content.
            print(f"read: {len(gen.token_ids)} tokens, finish={gen.finish_reason}")
            # Valid by construction; validate anyway and never trust blindly.
            return json.loads(RawRead.model_validate_json(gen.text).model_dump_json())

        raw = run(PROMPT)
        if _thin(raw):
            print("read: thin result, retrying with the full transcript prompt")
            raw = run(FULL_PROMPT)
        return normalize(raw)


def _thin(raw: dict) -> bool:
    return len(raw["transcript"]) < 3 or not raw["pairs"]


# --- Hosted path: Glimmer on Hugging Face Inference Providers ---------------
HF_MODEL = "meta-models/Muse-Glimmer-30B"
HF_PROVIDERS = ["deepinfra"]  # zero retention, structured output; 11-16 s per read
HF_URL = "https://router.huggingface.co/v1/chat/completions"
route = modal.Dict.from_name("lowkey-quote-route", create_if_missing=True)  # set by warm_window.py
hosted_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("requests", "pydantic>=2")
    .add_local_file(__file__.replace("serve.py", "schema.py"), "/root/schema.py")
    .add_local_file(__file__.replace("serve.py", "normalize.py"), "/root/normalize.py")
)


@app.function(
    image=hosted_image,
    secrets=[modal.Secret.from_name("huggingface")],
    min_containers=0,
    max_containers=4,
    scaledown_window=2 * MINUTES,
    timeout=10 * MINUTES,
)
def read_quote(image_b64: str, mime: str = "image/jpeg") -> dict:
    """Read on the hosted model; fall back to our own GPU if every provider fails."""
    import os
    import sys
    import time

    import requests

    sys.path.insert(0, "/root")
    from normalize import normalize
    from schema import RawRead

    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

    # During a warm window (warm_window.py on) our loaded GPU is the faster path.
    if route.get("gpu_until", 0) > time.time():
        try:
            return Reader().read.remote(image_b64, mime)
        except Exception as e:  # noqa: BLE001  (fall through to the hosted model)
            print(f"warm GPU read failed: {type(e).__name__}; trying the hosted model")

    def run(provider: str, prompt: str) -> dict:
        body = {
            "model": f"{HF_MODEL}:{provider}",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
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
        r = requests.post(HF_URL, headers={"Authorization": f"Bearer {token}"}, json=body, timeout=90)
        r.raise_for_status()
        data = r.json()
        choice = data["choices"][0]
        usage = data.get("usage") or {}
        # Timing, length and stop reason only; never the page's content.
        print(
            f"hosted read ({provider}): {time.time() - t:.1f}s, "
            f"{usage.get('completion_tokens')} tokens, finish={choice.get('finish_reason')}"
        )
        return json.loads(RawRead.model_validate_json(choice["message"]["content"]).model_dump_json())

    if token:
        for provider in HF_PROVIDERS:
            try:
                raw = run(provider, PROMPT)
                if _thin(raw):
                    print("hosted read: thin result, retrying with the full transcript prompt")
                    raw = run(provider, FULL_PROMPT)
                return normalize(raw)
            except Exception as e:  # noqa: BLE001  (try the next path)
                status = getattr(getattr(e, "response", None), "status_code", None)
                print(f"hosted read ({provider}) failed: {type(e).__name__} {status or ''}")
    print("hosted read unavailable; falling back to the Modal GPU")
    return Reader().read.remote(image_b64, mime)


# --- The public seam: a small CPU web app in front of the GPU class ---------
# Only the Low Key server calls this (bearer token from the Modal secret
# `lowkey-quote-auth`, mirrored in Vercel env). It never stores images,
# logs nothing from them, and enforces a daily ceiling with a modal.Dict.
web_image = modal.Image.debian_slim(python_version="3.12").pip_install("fastapi[standard]", "pydantic>=2")
counter = modal.Dict.from_name("lowkey-quote-daily", create_if_missing=True)
DAILY_CAP = 300
MAX_IMAGE_BYTES = 6 * 1024 * 1024


@app.function(
    image=web_image,
    secrets=[modal.Secret.from_name("lowkey-quote-auth")],
    min_containers=0,
    max_containers=4,
    scaledown_window=2 * MINUTES,
    timeout=3 * MINUTES,
)
@modal.concurrent(max_inputs=8)
@modal.asgi_app()
def web():
    import datetime
    import hmac
    import os

    from fastapi import FastAPI, Header, HTTPException
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel

    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    token = os.environ["QUOTE_TOKEN"]

    def check(authorization: str | None):
        want = f"Bearer {token}"
        if not authorization or not hmac.compare_digest(authorization, want):
            raise HTTPException(status_code=401)

    class ReadBody(BaseModel):
        image_b64: str
        mime: str = "image/jpeg"

    @api.post("/warm", status_code=202)
    async def warm(authorization: str | None = Header(None)):
        # The hosted model is always warm, so this no longer wakes the GPU
        # (it would cost GPU time for a path that is now only a fallback).
        check(authorization)
        return {"ok": True}

    @api.post("/read", status_code=202)
    async def read(body: ReadBody, authorization: str | None = Header(None)):
        """Start a read and return its id at once; poll /result/{id}."""
        check(authorization)
        if body.mime not in ("image/jpeg", "image/png", "image/webp"):
            raise HTTPException(status_code=415)
        if len(body.image_b64) * 3 // 4 > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413)
        day = datetime.date.today().isoformat()
        used = await counter.get.aio(day, 0)
        if used >= DAILY_CAP:
            raise HTTPException(status_code=429, detail="daily cap")
        await counter.put.aio(day, used + 1)
        call = await read_quote.spawn.aio(body.image_b64, body.mime)
        return {"id": call.object_id}

    @api.get("/result/{call_id}")
    async def result(call_id: str, authorization: str | None = Header(None)):
        check(authorization)
        if not call_id.startswith("fc-") or len(call_id) > 64:
            raise HTTPException(status_code=404)
        call = modal.FunctionCall.from_id(call_id)
        try:
            data = await call.get.aio(timeout=0)
        except TimeoutError:
            return JSONResponse({"status": "pending"}, status_code=202)
        except Exception:  # noqa: BLE001  (the read failed; the form stays usable)
            return JSONResponse({"status": "failed"}, status_code=200)
        return {"status": "done", "quote": data}

    return api


@app.local_entrypoint()
def main(image: str, gpu: bool = False):
    b64 = base64.b64encode(open(image, "rb").read()).decode()
    mime = "image/png" if image.lower().endswith(".png") else "image/jpeg"
    fn = Reader().read if gpu else read_quote
    print(json.dumps(fn.remote(b64, mime), indent=2))


@app.local_entrypoint()
def profile_start():
    import time

    t = time.time()
    print(Reader().warm.remote(), f"cold start {time.time() - t:.1f}s")
