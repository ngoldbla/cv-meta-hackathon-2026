"""Prestage model weights into a Modal Volume on cheap CPU (task 047).

Run once per model, off the request path:
    modal run cloud/quote_reader/stage.py --repo meta-models/Muse-Glimmer-30B
    modal run cloud/quote_reader/stage.py --check
The GPU service mounts the same Volume read-only, so a cold start only
reads local files and never touches the Hub.
"""

import modal

app = modal.App("lowkey-quote-stage")
vol = modal.Volume.from_name("lowkey-quote-models", create_if_missing=True)
image = modal.Image.debian_slim(python_version="3.12").pip_install("huggingface_hub>=0.30")
secret = modal.Secret.from_name("huggingface")

CHECK_REPOS = [
    "meta-models/Muse-Glimmer-30B",
    "meta-models/Muse-Glimmer-30B-GGUF",
    "facebook/sam3.1",
    "facebook/sam3",
]


@app.function(image=image, secrets=[secret], timeout=120)
def check():
    import os

    from huggingface_hub import HfApi

    api = HfApi(token=os.environ.get("HF_TOKEN"))
    for repo in CHECK_REPOS:
        try:
            info = api.model_info(repo, files_metadata=True)
            gb = sum((s.size or 0) for s in info.siblings) / 1e9
            api.hf_hub_download(repo, "config.json")
            print(f"OK        {repo}  {gb:.1f} GB  sha={info.sha[:10]}")
        except Exception as e:  # noqa: BLE001
            print(f"NO ACCESS {repo}  {type(e).__name__}")


@app.function(
    image=image,
    secrets=[secret],
    volumes={"/models": vol},
    cpu=4,
    memory=16384,
    timeout=3 * 3600,
)
def stage(repo: str, revision: str | None = None, allow: str | None = None):
    import os

    from huggingface_hub import snapshot_download

    dest = f"/models/{repo.replace('/', '__')}"
    path = snapshot_download(
        repo,
        revision=revision,
        local_dir=dest,
        allow_patterns=allow.split(",") if allow else None,
        token=os.environ.get("HF_TOKEN"),
        max_workers=8,
    )
    vol.commit()
    total = 0
    for root, _, files in os.walk(path):
        for f in files:
            total += os.path.getsize(os.path.join(root, f))
    print(f"staged {repo} -> {dest}  {total / 1e9:.1f} GB")


@app.local_entrypoint()
def main(
    repo: str = "", revision: str = "", allow: str = "", check_only: bool = False, check_access: bool = False
):
    if check_access or check_only:
        check.remote()
        return
    if not repo:
        raise SystemExit("pass --repo <org/name>, or --check-access")
    stage.remote(repo, revision or None, allow or None)
