"""Score the quote reader on the invented fixtures (task 047).

    modal run cloud/quote_reader/eval.py --dir ~/.cache/low-key/quote-fixtures --kind photo
Reads each fixture through the deployed-in-process Reader (one warm container),
compares to the truth file field by field, and prints a scorecard plus timings.
"""

import base64
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from serve import Reader, app  # noqa: F401  (registers the app and class)

KEYS = [
    "vin",
    "year",
    "make",
    "model",
    "trim",
    "selling_price",
    "msrp",
    "down",
    "out_the_door",
    "apr",
    "term_months",
    "stated_monthly",
    "epa_combined_mpg",
]


def norm(v):
    return v.strip().lower() if isinstance(v, str) else v


def close(a, b):
    if a is None or b is None:
        return a == b
    if isinstance(a, str) or isinstance(b, str):
        return norm(a) == norm(b)
    return abs(float(a) - float(b)) < 0.005


@app.local_entrypoint()
def score(dir: str = "~/.cache/low-key/quote-fixtures", kind: str = "photo"):
    root = Path(dir).expanduser()
    suffix = ".photo.jpg" if kind == "photo" else ".png"
    names = sorted(p.name[: -len(suffix)] for p in root.glob(f"*{suffix}"))
    reader = Reader()
    t0 = time.time()
    reader.warm.remote()
    print(f"cold start (first call): {time.time() - t0:.1f}s")
    hit = {k: [0, 0] for k in KEYS + ["fees", "doc_type", "vehicle_text"]}
    for name in names:
        truth = json.loads((root / f"{name}.truth.json").read_text())
        b64 = base64.b64encode((root / f"{name}{suffix}").read_bytes()).decode()
        t = time.time()
        got = reader.read.remote(b64, "image/jpeg" if kind == "photo" else "image/png")
        dt = time.time() - t
        (root / f"{name}.{kind}.out.json").write_text(json.dumps(got, indent=1))
        row = []
        for k in KEYS:
            if k in truth:
                ok = close(got.get(k), truth[k])
                hit[k][0] += ok
                hit[k][1] += 1
                if not ok:
                    row.append(f"{k}: got {got.get(k)!r} want {truth[k]!r}")
        if "make" in truth:
            want_v = f"{truth['make']} {truth['model']} {truth['trim']}".lower()
            ok = (got.get("vehicle_text") or "").lower() == want_v
            hit["vehicle_text"][0] += ok
            hit["vehicle_text"][1] += 1
            if not ok:
                row.append(f"vehicle_text: got {got.get('vehicle_text')!r} want {want_v!r}")
        hit["doc_type"][0] += got["doc_type"] == truth["doc_type"]
        hit["doc_type"][1] += 1
        if "fees" in truth:
            want = {(round(f["amount"]), f["kind"]) for f in truth["fees"]}
            have = {(round(f["amount"] or 0), f["kind"]) for f in got["fees"]}
            ok = want == have
            hit["fees"][0] += ok
            hit["fees"][1] += 1
            if not ok:
                row.append(f"fees: missing {sorted(want - have)} extra {sorted(have - want)}")
        print(f"{name} {dt:.1f}s", "OK" if not row else "; ".join(row))
    print("\nFIELD ACCURACY")
    for k, (a, b) in hit.items():
        if b:
            print(f"  {k:16s} {a}/{b}  {100 * a / b:.0f}%")
