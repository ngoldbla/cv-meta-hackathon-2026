"""Gas price forecasts: Timestral-28M on a scale-to-zero Modal GPU (task 058).

    modal deploy cloud/gas_forecast/serve.py      # idle cost: zero
    modal run    cloud/gas_forecast/serve.py      # one forced refresh now

Weights are prestaged in the Volume by stage.py. A weekly cron and the
app's POST /refresh both call refresh(), which fetches EIA and runs the
GPU only when EIA has a week newer than the stored forecasts: one GPU
call forecasts all series. A daily cap and a 6-hour debounce bound spend.
"""

import time

import modal

MODEL_DIR = "/models/mistralai__Timestral-28M"
TIMESTRAL = "git+https://github.com/mistralai/timestral.git@a534bdbd244d64f3d9d743f46c7bf6fc330ed4ff"
HERE = __file__.rsplit("/", 1)[0]

app = modal.App("lowkey-gas")
vol = modal.Volume.from_name("lowkey-gas-models")
store = modal.Dict.from_name("lowkey-gas-forecasts", create_if_missing=True)
secret = modal.Secret.from_name("lowkey-gas")

gpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("git")
    .pip_install("torch", "numpy", "safetensors", "huggingface_hub", TIMESTRAL)
    .env({"HF_HUB_OFFLINE": "1"})
    .add_local_file(f"{HERE}/core.py", "/root/core.py")
)
cpu_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("fastapi[standard]")
    .add_local_file(f"{HERE}/core.py", "/root/core.py")
    .add_local_file(f"{HERE}/eia.py", "/root/eia.py")
)


@app.cls(
    image=gpu_image,
    gpu="T4",
    volumes={"/models": vol},
    enable_memory_snapshot=True,
    experimental_options={"enable_gpu_snapshot": True},
    min_containers=0,
    max_containers=1,
    scaledown_window=60,
    timeout=600,
)
class Forecaster:
    @modal.enter(snap=True)
    def load(self):
        import numpy as np
        from timestral import TimestralForecaster

        self.model = TimestralForecaster.from_pretrained(MODEL_DIR, device="cuda")
        self.model.forecast(np.linspace(3.0, 3.5, 520), prediction_length=52)  # warm kernels

    @modal.method()
    def forecast(self, records: dict) -> dict:
        import numpy as np
        from core import HORIZON, entry_for

        t = time.time()
        out = {}
        for duoarea in sorted(records):
            values = np.asarray(records[duoarea]["values"], dtype=np.float64)
            result = self.model.forecast(values, prediction_length=HORIZON)
            levels = [float(x) for x in result.quantile_levels]
            q = result.quantiles[0, 0].detach().cpu().numpy()
            out[duoarea] = entry_for(records[duoarea], levels, q)
        print(f"forecast: {len(out)} series in {time.time() - t:.2f}s")
        return out


def _day() -> str:
    return time.strftime("day:%Y-%m-%d", time.gmtime())


@app.function(image=cpu_image, secrets=[secret], min_containers=0, timeout=900)
def refresh(force: bool = False) -> dict:
    import os

    from core import needs_forecast, pre_check
    from eia import fetch_all, newest_period

    now = time.time()
    why = pre_check(store.get("checkedAt"), store.get(_day(), 0), now, force)
    if why:
        print(f"refresh: {why}")
        return {"status": why}
    store["checkedAt"] = now
    records = fetch_all(os.environ["EIA_API_KEY"])
    newest = newest_period(records)
    current = store.get("current")
    if not needs_forecast(newest, current["eiaAsOf"] if current else None):
        print(f"refresh: unchanged ({newest})")
        return {"status": "unchanged", "eiaAsOf": newest}
    store[_day()] = store.get(_day(), 0) + 1
    series = Forecaster().forecast.remote(records)
    store["current"] = {
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "eiaAsOf": newest,
        "model": "mistralai/Timestral-28M",
        "horizonWeeks": 52,
        "series": series,
    }
    print(f"refresh: updated {len(series)} series to {newest}")
    return {"status": "updated", "eiaAsOf": newest, "series": len(series)}


@app.function(image=cpu_image, schedule=modal.Cron("0 5 * * 2", timezone="America/New_York"))
def weekly():
    print(refresh.remote(force=True))


@app.function(image=cpu_image, secrets=[secret], min_containers=0, scaledown_window=120)
@modal.concurrent(max_inputs=16)
@modal.asgi_app()
def web():
    import hmac
    import os

    from core import pre_check
    from fastapi import FastAPI, Header, HTTPException
    from fastapi.responses import JSONResponse

    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    token = os.environ["GAS_TOKEN"]

    def check(authorization: str | None):
        if not authorization or not hmac.compare_digest(authorization, f"Bearer {token}"):
            raise HTTPException(status_code=401)

    @api.get("/gas")
    async def gas(authorization: str | None = Header(None)):
        check(authorization)
        current = await store.get.aio("current")
        if not current:
            raise HTTPException(status_code=404)
        return current

    @api.post("/refresh", status_code=202)
    async def start(authorization: str | None = Header(None)):
        check(authorization)
        why = pre_check(await store.get.aio("checkedAt"), await store.get.aio(_day(), 0), time.time(), False)
        if why == "capped":
            return JSONResponse({"detail": "capped"}, status_code=429)
        if why == "debounced":
            return {"status": "debounced"}
        await refresh.spawn.aio()
        return {"status": "started"}

    return api


@app.local_entrypoint()
def main():
    print(refresh.remote(force=True))
