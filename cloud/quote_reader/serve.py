"""Quote reader: Muse Glimmer-30B on a scale-to-zero Modal GPU (task 047).

    modal deploy cloud/quote_reader/serve.py        # idle cost: zero
    modal run   cloud/quote_reader/serve.py --image path.jpg

Weights are prestaged in the Volume by stage.py. The model only READS:
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
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("vllm==0.32.0", "pydantic>=2", "pillow", "huggingface_hub")
    .env({"HF_HUB_OFFLINE": "1", "VLLM_LOGGING_LEVEL": "WARNING"})
    .add_local_file(__file__.replace("serve.py", "schema.py"), "/root/schema.py")
)

PROMPT = (
    "Read this car-buying document (a window sticker, a dealer's buyer's order, "
    "a payment offer or a listing sheet). Fill in the JSON exactly as the page "
    "states it. Copy numbers and the VIN character for character. If a value is "
    "not printed on the page, use null; never infer, calculate or guess. Label "
    "each fee: government (tax, title, registration), dealer (doc/dealer fee), "
    "addon (anything optional or installed by the dealer), else unknown."
)


@app.cls(
    image=image,
    gpu=GPU,
    volumes={"/models": vol},
    min_containers=0,  # nothing runs, nothing costs, until summoned
    max_containers=2,  # hard ceiling on spend
    scaledown_window=2 * MINUTES,
    timeout=10 * MINUTES,
)
class Reader:
    @modal.enter()
    def load(self):
        from vllm import LLM

        self.llm = LLM(
            model=MODEL_DIR,
            max_model_len=16384,
            limit_mm_per_prompt={"image": 1},
            gpu_memory_utilization=0.90,
        )

    @modal.method()
    def warm(self) -> str:
        return "ready"

    @modal.method()
    def read(self, image_b64: str, mime: str = "image/jpeg") -> dict:
        import sys

        sys.path.insert(0, "/root")
        from schema import ReadQuote
        from vllm import SamplingParams
        from vllm.sampling_params import StructuredOutputsParams

        params = SamplingParams(
            temperature=0.0,
            max_tokens=1500,
            structured_outputs=StructuredOutputsParams(json=ReadQuote.model_json_schema()),
        )
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
                    {"type": "text", "text": PROMPT},
                ],
            }
        ]
        out = self.llm.chat(messages, params)[0].outputs[0].text
        # Valid by construction; validate anyway and never trust blindly.
        return json.loads(ReadQuote.model_validate_json(out).model_dump_json())


@app.local_entrypoint()
def main(image: str):
    b64 = base64.b64encode(open(image, "rb").read()).decode()
    mime = "image/png" if image.lower().endswith(".png") else "image/jpeg"
    print(json.dumps(Reader().read.remote(b64, mime), indent=2))
