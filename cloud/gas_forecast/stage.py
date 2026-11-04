"""Prestage Timestral-28M into a Modal Volume on CPU (task 058).

    modal run cloud/gas_forecast/stage.py
The GPU class mounts the Volume read-only with HF_HUB_OFFLINE=1, so a
cold start reads local files and never touches the Hub.
"""

import modal

REPO = "mistralai/Timestral-28M"
app = modal.App("lowkey-gas-stage")
vol = modal.Volume.from_name("lowkey-gas-models", create_if_missing=True)
image = modal.Image.debian_slim(python_version="3.12").pip_install("huggingface_hub>=0.30")


@app.function(image=image, volumes={"/models": vol}, timeout=1800)
def stage():
    import os

    from huggingface_hub import snapshot_download

    dest = f"/models/{REPO.replace('/', '__')}"
    snapshot_download(REPO, local_dir=dest, allow_patterns=["config.json", "model.safetensors", "LICENSE*"])
    vol.commit()
    for name in sorted(os.listdir(dest)):
        print(name, os.path.getsize(os.path.join(dest, name)))


@app.local_entrypoint()
def main():
    stage.remote()
