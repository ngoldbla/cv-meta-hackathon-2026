# VIN-first quote check: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Check a quote" identify the car from its VIN (barcode or photo) through the provider's VIN lookup, read only the money terms from the photo, and price used cars on a per-model age curve placed by an effective age from age and miles.

**Architecture:** Two parallel tracks start when a photo is chosen. Track 1 decodes a VIN barcode in the browser, then calls `/api/vin`, which validates the VIN and calls the provider. Track 2 sends the photo to the existing Modal reader in a new `terms` mode: Glimmer copies at most nine kinds of label/value pairs, and `normalize_terms()` decides the fields in code. The confirm form shows the car from the VIN and the terms. `compare.ts` prices the deal with one signed fee lump, and with a used-car resale curve when the car isn't new.

**Tech stack:** Next.js 16 / React / TypeScript / zod / vitest (`lowkey/app`); Python 3.12 / pydantic / pytest (`cloud/quote_reader`, `lowkey/pipeline`, `lowkey/preflight`); Modal; `zxing-wasm` 3.x (new).

**Spec:** `lowkey/docs/specs/2026-11-04-vin-first-quote-design.md`

## Global constraints
- Branch `task/057-vin-first-quote`, PR into `main`. Never push to `main`; no force-pushes.
- Commits end with the trailer `Assisted-by: agent`, and never name an assistant vendor or product.
- The listings provider is never named in the app, its copy, branch names or commit messages (`python scripts/name_guard.py`).
- Secrets never enter git, chat or logs (`python scripts/secret_guard.py --all` before every commit). Keys come from `~/.config/low-key/env`, loaded with `set -a; . ~/.config/low-key/env; set +a`; never print them.
- Numbers come from code. The model only copies printed text. Never weaken the number guard, a test or a tolerance.
- **Provider spend:** $0.25 for the VIN probe and checks, plus $1 for the mileage-weight fit. The table is rebuilt from cache (0 provider calls).
- The image is never stored or logged. Log lengths, timings and stop reasons only.
- Dylan's real paperwork lives only in `~/.cache/low-key/real/`. Never commit it; tests use invented values.
- **Tests:** `GOOD_VIN = "1HGCV2FA9SB601815"` (check digit valid) is the invented test VIN.
- **Definition of done:** `npm ci && npm run build` and `npm test` in `lowkey/app`; `.venv/bin/python -m pytest -q` at the repo root; both guards; a report in `ops/reports/057-lowkey-vin-first-quote.md`; the task file `ops/tasks/057-lowkey-vin-first-quote.md` with `status: done`.
- **The confirm "chips"** in the spec are the existing labelled inputs in `QuoteCheck.tsx`, each with a source label. No new chip component.
- **Payment grids:** the terms read has no transcript, so it can't parse a payment grid. Several printed terms resolve to `term_months = null` (the "grid ≠ term" rule). The APR implied by a stated payment still comes from `compare.ts` (`impliedApr`).

## File map
| File | Change |
|---|---|
| `ops/tasks/057-lowkey-vin-first-quote.md` | create (Task 0) |
| `lowkey/app/lib/fixtures/vin-response.json` | create: the probe response, VIN replaced (Task 0) |
| `cloud/quote_reader/schema.py` | add `TermPair`, `TermsRead` (Task 1) |
| `cloud/quote_reader/normalize.py` | add `normalize_terms`, `terms_thin` (Task 1) |
| `cloud/quote_reader/tests/test_normalize_terms.py` | create (Task 1) |
| `cloud/quote_reader/serve.py` | `TERMS_PROMPT`, a `mode` on `Reader.read`, `read_quote` and `/read` (Task 2) |
| `cloud/quote_reader/eval.py` | a `--mode` argument and terms scoring (Task 2) |
| `lowkey/app/lib/vin.ts`, `lib/vin.test.ts` | create (Task 3) |
| `lowkey/app/app/api/vin/route.ts` | create (Task 3) |
| `lowkey/preflight/lineup.py`, `lowkey/pipeline/build_table.py`, `lowkey/app/lib/table.ts` | add `retentionByAge` and `retentionSlopePerYear` (Task 4) |
| `lowkey/preflight/test_lineup.py` | a test for the new fields (Task 4) |
| `lowkey/pipeline/mileage_weight.py`, `lowkey/pipeline/test_mileage_weight.py` | create (Task 5) |
| `lowkey/app/lib/mileage-weight.json` | create, from the fit (Task 5) |
| `lowkey/app/lib/used.ts`, `lib/used.test.ts` | create (Task 6) |
| `lowkey/app/lib/ownership.ts` | an optional `resaleFactor` (Task 6) |
| `lowkey/app/lib/quote/compare.ts`, `compare.test.ts` | `resaleFactor` passthrough and the fee lump (Task 6) |
| `lowkey/app/lib/quote/barcode.ts`, `barcode.test.ts` | create (Task 7) |
| `lowkey/app/package.json`, `lowkey/app/scripts/copy-zxing-wasm.mjs`, `.gitignore` | the zxing dependency and its wasm copy (Task 7) |
| `lowkey/app/lib/quote/schema.ts`, `schema.test.ts` | `mode`, `mileage`, `price_basis`, `car` (Task 8) |
| `lowkey/app/app/api/quote/read/route.ts` | pass `mode` through (Task 8) |
| `lowkey/app/components/QuoteCheck.tsx` | parallel tracks, car header, mileage, lump line, "Read everything" (Task 9) |
| `ops/reports/057-lowkey-vin-first-quote.md` | create (Task 10) |

---

### Task 0: Task file and the live VIN probe

This task confirms the provider's VIN response before any code depends on it.

**Files:**
- Create: `ops/tasks/057-lowkey-vin-first-quote.md`
- Create: `lowkey/app/lib/fixtures/vin-response.json`

- [ ] **Step 1: Write the task file**

```markdown
---
id: "057"
title: "Low Key: VIN-first quote check"
status: in-progress
created: 2026-11-04
report: ops/reports/057-lowkey-vin-first-quote.md
---
# Low Key: VIN-first quote check

**Branch: `task/057-vin-first-quote` cut from `main`, with a PR into `main`.** The rules of task 055 apply. Provider cap: $0.25 for checks plus $1 for the mileage-weight fit; the table is rebuilt from cache.

Design: `lowkey/docs/specs/2026-11-04-vin-first-quote-design.md`. Plan: `lowkey/docs/plans/2026-11-04-vin-first-quote.md`.

## Why (Dylan, 2026-11-04)
A much simpler way to digest cars for comparison: take the VIN, load the car from the API, and read only the financial terms (price, down, APR, term) and the mileage from the photo.
```

- [ ] **Step 2: Pick a real active VIN from the cache, without a new call**

Run:
```bash
cd ~/cv-meta-hackathon-2026 && python3 - <<'EOF'
import json, glob
for f in glob.glob("/home/ndgold/.cache/low-key/preflight/*.json"):
    s = open(f).read()
    if '"vin"' in s and '"listings"' not in s[:50]:
        try: d = json.loads(s)
        except Exception: continue
        rows = d.get("data") if isinstance(d.get("data"), list) else []
        for r in rows:
            if isinstance(r, dict) and r.get("vin"):
                print(r["vin"]); raise SystemExit
EOF
```
Expected: one 17-character VIN. If nothing prints, run a local search on `next start` (as in task 054) and take a VIN from a listing card.

- [ ] **Step 3: Make one live call and record its cost** (`SCRATCH=$(mktemp -d)` holds the raw response; never commit it)

```bash
set -a; . ~/.config/low-key/env; set +a
VIN=<the VIN from step 2>
curl -s -D $SCRATCH/vin.h \
  -H "Authorization: Bearer $LOWKEY_PROVIDER_KEY" -H "Accept: application/json" \
  "$LOWKEY_PROVIDER_BASE_URL/vins/$VIN" > $SCRATCH/vin.json
grep -i "x-usage" $SCRATCH/vin.h
python3 -c "import json;d=json.load(open('$SCRATCH/vin.json'))['data'];print(d['status'],d['build']['year'],d['build']['make'],d['build']['model'],d['build']['trim'],d['build'].get('combined_msrp'),(d.get('latest_listing') or {}).get('price'),(d.get('latest_listing') or {}).get('miles'))"
```
Expected: an `X-Usage-Class: vehicle_detail` header, an `X-Usage-Cost-Micros` value, and a line such as `active 2026 Toyota Corolla LE 24xxx 2xxxx 5`. Write down the cost for the report. **Stop and report to Dylan** if the shape differs from `data.status`, `data.build.{year,make,model,trim,base_msrp,combined_msrp}` or `data.latest_listing.{price,miles,dealer.name}`.

- [ ] **Step 4: Save the fixture with the VIN replaced**

```bash
python3 - <<'EOF'
import json
import os
p = os.path.join(os.environ["SCRATCH"], "vin.json")  # run `export SCRATCH` first
d = json.load(open(p))
d["data"]["vin"] = "1HGCV2FA9SB601815"
ll = d["data"].get("latest_listing") or {}
for k in ("id", "stock_number", "vdp_url", "vhr_url", "comments", "photo_urls", "photo_url_primary", "price_history"):
    ll.pop(k, None)
dealer = ll.get("dealer") or {}
for k in list(dealer):
    if k != "name": dealer.pop(k)
if dealer: dealer["name"] = "Example Motors"
json.dump(d, open("/home/ndgold/cv-meta-hackathon-2026/lowkey/app/lib/fixtures/vin-response.json", "w"), indent=1)
EOF
```

- [ ] **Step 5: Commit**

```bash
cd ~/cv-meta-hackathon-2026 && .venv/bin/python scripts/secret_guard.py --all && .venv/bin/python scripts/name_guard.py
git add ops/tasks/057-lowkey-vin-first-quote.md lowkey/app/lib/fixtures/vin-response.json
git commit -m "057: the task file and a VIN lookup fixture

Assisted-by: agent"
```

---

### Task 1: The terms schema and `normalize_terms()`

**Files:**
- Modify: `cloud/quote_reader/schema.py` (append)
- Modify: `cloud/quote_reader/normalize.py` (append)
- Create: `cloud/quote_reader/tests/test_normalize_terms.py`

**Interfaces:**
- Produces: `TermsRead` (pydantic). `normalize_terms(raw: dict) -> dict` returns `doc_type="terms"`, `mode="terms"`, `vin`, `vin_check_ok`, `make_from_vin`, `selling_price`, `msrp`, `price_basis` (`"selling"|"msrp"|None`), `down`, `out_the_door`, `stated_monthly`, `apr`, `term_months`, `mileage`, `fees=[]`, `payment_options=[]` and `pairs`. `terms_thin(raw: dict) -> bool`.

- [ ] **Step 1: Write the failing tests**

```python
# cloud/quote_reader/tests/test_normalize_terms.py
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from normalize import normalize_terms, terms_thin  # noqa: E402

GOOD_VIN = "1HGCV2FA9SB601815"


def raw(*pairs):
    return {"pairs": [{"kind": k, "label": l, "value": v} for k, l, v in pairs]}


def test_buyers_order_terms():
    out = normalize_terms(raw(
        ("price", "Selling Price", "$28,450.00"),
        ("down", "Cash Down", "$3,000"),
        ("apr", "APR", "6.9%"),
        ("term", "Term", "72 mo"),
        ("monthly", "Monthly Payment", "$512.33"),
        ("out_the_door", "Total Cash Price", "$31,204.10"),
        ("mileage", "Odometer", "18,420"),
        ("vin", "VIN", GOOD_VIN),
    ))
    assert out["mode"] == "terms" and out["doc_type"] == "terms"
    assert out["selling_price"] == 28450.0 and out["price_basis"] == "selling"
    assert out["down"] == 3000.0
    assert out["apr"] == 6.9
    assert out["term_months"] == 72
    assert out["stated_monthly"] == 512.33
    assert out["out_the_door"] == 31204.10
    assert out["mileage"] == 18420
    assert out["vin"] == GOOD_VIN and out["vin_check_ok"] is True
    assert out["make_from_vin"] == "Honda"
    assert out["fees"] == [] and out["payment_options"] == []


def test_label_priority_prefers_selling_price():
    out = normalize_terms(raw(
        ("price", "Price", "$30,000"),
        ("price", "Selling Price", "$28,450"),
    ))
    assert out["selling_price"] == 28450.0


def test_sticker_only_price_uses_msrp():
    out = normalize_terms(raw(("msrp", "Total MSRP", "$27,315")))
    assert out["selling_price"] is None
    assert out["msrp"] == 27315.0 and out["price_basis"] == "msrp"


def test_split_vin_is_joined_and_checked():
    out = normalize_terms(raw(("vin", "VIN", "1HGCV2 FA9SB 601815")))
    assert out["vin"] == GOOD_VIN and out["vin_check_ok"] is True


def test_bad_vin_kept_but_flagged():
    out = normalize_terms(raw(("vin", "VIN", "1HGCV2FA0SB601815")))
    assert out["vin"] == "1HGCV2FA0SB601815" and out["vin_check_ok"] is False
    assert out["make_from_vin"] is None


def test_grid_of_terms_is_not_a_term():
    out = normalize_terms(raw(("term", "60 months", "60"), ("term", "72 months", "72")))
    assert out["term_months"] is None


def test_apr_out_of_range_is_dropped():
    out = normalize_terms(raw(("apr", "APR", "69%")))
    assert out["apr"] is None


def test_mileage_digits_only():
    assert normalize_terms(raw(("mileage", "Miles", "18,420 mi")))["mileage"] == 18420
    assert normalize_terms(raw(("mileage", "Miles", "n/a")))["mileage"] is None


def test_thin_when_fewer_than_two_money_values():
    assert terms_thin(raw(("price", "Price", "$28,450")))
    assert not terms_thin(raw(("price", "Price", "$28,450"), ("apr", "APR", "6.9%")))
    assert terms_thin({"pairs": []})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd ~/cv-meta-hackathon-2026 && .venv/bin/python -m pytest cloud/quote_reader/tests/test_normalize_terms.py -q`
Expected: fails with `ImportError: cannot import name 'normalize_terms'`.

- [ ] **Step 3: Add the schema** (append to `schema.py`)

```python
class TermPair(BaseModel):
    kind: Literal["price", "msrp", "down", "apr", "term", "monthly", "out_the_door", "mileage", "vin"]
    label: str = Field(description="The label printed on the page, copied exactly")
    value: str = Field(description="The value printed for that label, copied exactly")


class TermsRead(BaseModel):
    """Task 057: the small read. Only the money terms, the mileage and the VIN."""

    pairs: list[TermPair] = Field(
        min_length=1,
        description="Only the listed kinds, each as printed. Skip everything else.",
    )
```

- [ ] **Step 4: Add `normalize_terms` and `terms_thin`** (append to `normalize.py`)

```python
# --- Task 057: the terms read -------------------------------------------------
# Label priority within one kind, most specific first (matched on the whole label).
_TERM_PRIORITY = {
    "price": ["selling price", "sale price", "sales price", "cash price", "vehicle price", "your price", "price"],
    "out_the_door": ["out the door", "out-the-door", "otd", "total due", "total cash price", "total"],
    "monthly": ["monthly payment", "your payment", "payment", "per month"],
    "down": ["cash down", "down payment", "down"],
}
_MONEY_KINDS = ("price", "msrp", "down", "apr", "out_the_door", "monthly")


def _ranked(pairs: list[dict], kind: str) -> list[dict]:
    cands = [p for p in pairs if p["kind"] == kind]
    pri = _TERM_PRIORITY.get(kind)
    if not pri:
        return cands

    def rank(p: dict) -> int:
        k = _label_key(p["label"])
        for i, frag in enumerate(pri):
            if k == frag or (len(frag) > 4 and frag in k):
                return i
        return len(pri)

    return sorted(cands, key=rank)  # stable: the page's order breaks ties


def _clean_pairs(raw: dict) -> list[dict]:
    return [
        {"kind": str(p.get("kind", "")), "label": str(p.get("label", "")), "value": str(p.get("value", ""))}
        for p in raw.get("pairs", [])
    ]


def terms_thin(raw: dict) -> bool:
    """Fewer than two money values: run the full read instead."""
    pairs = _clean_pairs(raw)
    return sum(1 for p in pairs if p["kind"] in _MONEY_KINDS and parse_money(p["value"]) is not None) < 2


def normalize_terms(raw: dict) -> dict:
    pairs = _clean_pairs(raw)
    out: dict = {
        "doc_type": "terms",
        "mode": "terms",
        "fees": [],
        "payment_options": [],
        "pairs": [{"label": p["label"], "value": p["value"]} for p in pairs],
    }

    def money(kind: str) -> float | None:
        for p in _ranked(pairs, kind):
            v = parse_money(p["value"])
            if v is not None and v > 0:
                return v
        return None

    out["selling_price"] = money("price")
    out["msrp"] = money("msrp")
    out["down"] = money("down")
    out["out_the_door"] = money("out_the_door")
    out["stated_monthly"] = money("monthly")
    out["price_basis"] = (
        "selling" if out["selling_price"] is not None else ("msrp" if out["msrp"] is not None else None)
    )

    out["apr"] = None
    for p in _ranked(pairs, "apr"):
        m = re.search(r"(\d{1,2}(?:\.\d+)?)", p["value"])
        if m and 0 <= float(m.group(1)) <= 40:
            out["apr"] = float(m.group(1))
            break

    # One printed loan length only; several are a grid of options, not a term.
    terms = set()
    for p in _ranked(pairs, "term"):
        m = re.search(r"\b(\d{2,3})\b", p["value"]) or re.search(r"\b(\d{2,3})\b", p["label"])
        if m and 6 <= int(m.group(1)) <= 120:
            terms.add(int(m.group(1)))
    out["term_months"] = terms.pop() if len(terms) == 1 else None

    out["mileage"] = None
    for p in _ranked(pairs, "mileage"):
        digits = re.sub(r"[^\d]", "", p["value"])
        if digits and int(digits) < 1_000_000:
            out["mileage"] = int(digits)
            break

    out["vin"], out["vin_check_ok"] = None, False
    for p in _ranked(pairs, "vin"):
        cand = re.sub(r"[^A-Z0-9]", "", p["value"].upper())
        if len(cand) == 17:
            if vin_check_ok(cand):
                out["vin"], out["vin_check_ok"] = cand, True
                break
            out["vin"] = out["vin"] or cand
    out["make_from_vin"] = _WMI.get(out["vin"][:3]) if out["vin"] and out["vin_check_ok"] else None
    return out
```

- [ ] **Step 5: Run the tests**

Run: `.venv/bin/python -m pytest cloud/quote_reader/tests -q`
Expected: every test passes, the old `test_normalize.py` included. If `make_from_vin` isn't "Honda", check `_WMI["1HG"]` and change the test's expected make to the map's value, since the map is the source.

- [ ] **Step 6: Commit**

```bash
git add cloud/quote_reader/schema.py cloud/quote_reader/normalize.py cloud/quote_reader/tests/test_normalize_terms.py
git commit -m "057: the terms read schema and its normalizer

Assisted-by: agent"
```

---

### Task 2: The reader's terms mode, the eval gate and the deploy

**Files:**
- Modify: `cloud/quote_reader/serve.py`
- Modify: `cloud/quote_reader/eval.py`

**Interfaces:**
- Consumes: `TermsRead`, `normalize_terms`, `terms_thin` (Task 1).
- Produces: `POST /read` accepts `{"image_b64", "mime", "mode": "terms" | "full"}`, defaulting to `"full"`, so the current client keeps working. `/result/{id}` returns `quote` with `mode: "terms"` for terms reads.

- [ ] **Step 1: Add the prompt** (after `PROMPT` in `serve.py`)

```python
# Task 057: the small read. Only these kinds; the car comes from the VIN lookup.
TERMS_PROMPT = (
    "List only these values if they are printed: vehicle price, MSRP, down payment, "
    "APR, term, monthly payment, out-the-door total, odometer mileage, VIN. "
    "Copy each label and value exactly, and tag each with its kind. Skip everything else. "
    "Never calculate or guess."
)
TERMS_MAX_TOKENS = 600
```

- [ ] **Step 2: Give `Reader.read` a mode**

Replace the method signature and body tail in `class Reader`:
```python
    @modal.method()
    def read(self, image_b64: str, mime: str = "image/jpeg", mode: str = "full") -> dict:
        import sys

        sys.path.insert(0, "/root")
        from normalize import normalize, normalize_terms, terms_thin
        from schema import RawRead, TermsRead
        from vllm import SamplingParams
        from vllm.sampling_params import StructuredOutputsParams

        def params_for(model_cls, max_tokens):
            return SamplingParams(
                temperature=0.0,
                max_tokens=max_tokens,
                structured_outputs=StructuredOutputsParams(json=model_cls.model_json_schema()),
            )

        def run(prompt: str, model_cls=RawRead, max_tokens: int = 6000) -> dict:
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ]
            gen = self.llm.chat(messages, params_for(model_cls, max_tokens))[0].outputs[0]
            print(f"read ({mode}): {len(gen.token_ids)} tokens, finish={gen.finish_reason}")
            return json.loads(model_cls.model_validate_json(gen.text).model_dump_json())

        if mode == "terms":
            raw = run(TERMS_PROMPT, TermsRead, TERMS_MAX_TOKENS)
            if not terms_thin(raw):
                return normalize_terms(raw)
            print("read: thin terms result, running the full read")
        raw = run(PROMPT)
        if _thin(raw):
            print("read: thin result, retrying with the full transcript prompt")
            raw = run(FULL_PROMPT)
        return normalize(raw)
```

- [ ] **Step 3: Give `read_quote` a mode**

Change the signature to `def read_quote(image_b64: str, mime: str = "image/jpeg", mode: str = "full") -> dict:`. Import `from normalize import normalize, normalize_terms, terms_thin` and `from schema import RawRead, TermsRead`. Change the warm-GPU call to `Reader().read.remote(image_b64, mime, mode)` and the final fallback to `return Reader().read.remote(image_b64, mime, mode)`. Make `run` take the schema and token limit:
```python
    def run(provider: str, prompt: str, model_cls=RawRead, max_tokens: int = 6000) -> dict:
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
                "json_schema": {"name": model_cls.__name__, "schema": model_cls.model_json_schema(), "strict": True},
            },
            "temperature": 0,
            "chat_template_kwargs": {"enable_thinking": False},
            "max_tokens": max_tokens,
        }
        t = time.time()
        r = requests.post(HF_URL, headers={"Authorization": f"Bearer {token}"}, json=body, timeout=90)
        r.raise_for_status()
        data = r.json()
        choice = data["choices"][0]
        usage = data.get("usage") or {}
        print(
            f"hosted read ({provider}, {mode}): {time.time() - t:.1f}s, "
            f"{usage.get('completion_tokens')} tokens, finish={choice.get('finish_reason')}"
        )
        return json.loads(model_cls.model_validate_json(choice["message"]["content"]).model_dump_json())
```
And the provider loop:
```python
    if token:
        for provider in HF_PROVIDERS:
            try:
                if mode == "terms":
                    raw = run(provider, TERMS_PROMPT, TermsRead, TERMS_MAX_TOKENS)
                    if not terms_thin(raw):
                        return normalize_terms(raw)
                    print("hosted read: thin terms result, running the full read")
                raw = run(provider, PROMPT)
                if _thin(raw):
                    print("hosted read: thin result, retrying with the full transcript prompt")
                    raw = run(provider, FULL_PROMPT)
                return normalize(raw)
            except Exception as e:  # noqa: BLE001  (try the next path)
                status = getattr(getattr(e, "response", None), "status_code", None)
                print(f"hosted read ({provider}) failed: {type(e).__name__} {status or ''}")
```

- [ ] **Step 4: Pass `mode` through the web front**

In `web()`:
```python
    class ReadBody(BaseModel):
        image_b64: str
        mime: str = "image/jpeg"
        mode: str = "full"
```
In `read()`, after the mime check: `if body.mode not in ("terms", "full"): raise HTTPException(status_code=422)`. Change the spawn to `call = await read_quote.spawn.aio(body.image_b64, body.mime, body.mode)`.

- [ ] **Step 5: Add a mode to the eval**

In `eval.py`, change `read` and `score`:
```python
TERMS_KEYS = ["vin", "selling_price", "msrp", "down", "out_the_door", "apr", "term_months", "stated_monthly"]


def read(b64, mime, mode="full"):
    _, started = call("POST", "/read", {"image_b64": b64, "mime": mime, "mode": mode})
    while True:
        status, body = call("GET", f"/result/{started['id']}")
        if status == 200:
            if body.get("status") != "done":
                raise RuntimeError("read failed")
            return body["quote"]
        time.sleep(0.5)
```
In `score(dir, kind, mode="full")`, use `keys = TERMS_KEYS if mode == "terms" else KEYS`, pass `mode` to `read`, write `f"{name}.{kind}.{mode}.out.json"`, and skip the `vehicle_text`, `doc_type` and `fees` blocks when `mode == "terms"`. Collect per-read seconds into a list and print `median read {statistics.median(times):.1f}s` (add `import statistics`). The entry point becomes `score(*sys.argv[1:4])`.

- [ ] **Step 6: Deploy and run both modes**

```bash
cd ~/cv-meta-hackathon-2026 && cat cloud/quote_reader/redeploy.sh | head -20   # use its documented deploy command
set -a; . ~/.config/low-key/env; set +a
bash cloud/quote_reader/redeploy.sh
.venv/bin/python cloud/quote_reader/eval.py ~/.cache/low-key/quote-fixtures photo full  | tee ~/.cache/low-key/eval-057-full.txt
.venv/bin/python cloud/quote_reader/eval.py ~/.cache/low-key/quote-fixtures photo terms | tee ~/.cache/low-key/eval-057-terms.txt
```
Expected: two FIELD ACCURACY tables and a median time for each mode. **Gate:** for every key in `TERMS_KEYS`, the terms accuracy is at least the full accuracy, and the terms median is 4.0 s or less. If a key falls short, change only `TERMS_PROMPT` (never the scoring) and repeat at most twice. If it still falls short, record both tables in the report and keep `"full"` as the client default in Task 9.

- [ ] **Step 7: Check the two real documents locally (never committed)**

```bash
for f in ~/.cache/low-key/real/newnan-corolla.jpg ~/.cache/low-key/real/lexus-ct200h-sticker.jpg; do
  .venv/bin/python - "$f" <<'EOF'
import base64, json, sys, time
sys.path.insert(0, "cloud/quote_reader")
from eval import read
t = time.time()
out = read(base64.b64encode(open(sys.argv[1], "rb").read()).decode(), "image/jpeg", "terms")
print(sys.argv[1].rsplit("/", 1)[1], f"{time.time() - t:.1f}s",
      {k: out.get(k) for k in ("selling_price", "msrp", "down", "apr", "term_months", "out_the_door", "mileage", "vin_check_ok")})
EOF
done
```
Expected: the Corolla shows the worksheet's price, down and APR; the Lexus shows `msrp` with `price_basis` "msrp" and `vin_check_ok` True. Compare against `~/.cache/low-key/real/*.trim.json`. The report gets only pass/fail per field, never the values.

- [ ] **Step 8: Commit**

```bash
.venv/bin/python -m pytest -q cloud/quote_reader/tests && .venv/bin/python scripts/secret_guard.py --all
git add cloud/quote_reader/serve.py cloud/quote_reader/eval.py
git commit -m "057: a terms mode for the quote reader, and the eval to gate it

Assisted-by: agent"
```

---

### Task 3: The VIN lookup (`lib/vin.ts` and `/api/vin`)

**Files:**
- Create: `lowkey/app/lib/vin.ts`, `lowkey/app/lib/vin.test.ts`
- Create: `lowkey/app/app/api/vin/route.ts`

**Interfaces:**
- Consumes: `vinCheckOk` (`lib/quote/schema.ts`), `getTable` and `resolveTablePick` (`lib/table.ts`), and the fixture from Task 0.
- Produces:
```ts
export interface VinFacts {
  vin: string;
  status: "active" | "sold" | "missing";
  year: number | null; make: string | null; model: string | null; trim: string | null;
  msrp: number | null; listedPrice: number | null; miles: number | null; dealerName: string | null;
}
export type VinLookup =
  | { ok: true; facts: VinFacts }
  | { ok: false; reason: "bad_vin" | "not_found" | "unavailable" | "resting" };
export function mapVinResponse(body: unknown): VinFacts | null;
export async function lookupVin(vin: string, opts?: { fetcher?: typeof fetch; baseUrl?: string; apiKey?: string }): Promise<VinLookup>;
export function allowVin(key: string, now?: number): boolean;
```
- `GET /api/vin?vin=…` returns the `VinLookup` JSON plus, when ok, `retention: { retention5y: number; byAge: Record<string, number> | null; slopePerYear: number | null } | null` from the table (filled by Task 4; `byAge` and `slopePerYear` are null until then).

- [ ] **Step 1: Write the failing tests**

```ts
// lowkey/app/lib/vin.test.ts
import { describe, expect, it } from "vitest";

import fixture from "./fixtures/vin-response.json";
import { allowVin, lookupVin, mapVinResponse, VIN_PER_HOUR } from "./vin";

const VIN = "1HGCV2FA9SB601815";
const res = (status: number, body: unknown = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("mapVinResponse", () => {
  it("keeps only the facts the quote uses", () => {
    const f = mapVinResponse(fixture);
    expect(f).not.toBeNull();
    expect(f!.vin).toBe(VIN);
    expect(["active", "sold", "missing"]).toContain(f!.status);
    expect(typeof f!.year).toBe("number");
    expect(Object.keys(f!).sort()).toEqual(
      ["dealerName", "listedPrice", "make", "miles", "model", "msrp", "status", "trim", "vin", "year"].sort(),
    );
  });
  it("rejects a body without data", () => {
    expect(mapVinResponse({})).toBeNull();
  });
});

describe("lookupVin", () => {
  const opts = { baseUrl: "https://example.test/v1", apiKey: "k" };
  it("never calls the provider for a VIN whose check digit fails", async () => {
    let called = false;
    const r = await lookupVin("1HGCV2FA0SB601815", { ...opts, fetcher: (() => ((called = true), res(200, fixture))) as typeof fetch });
    expect(r).toEqual({ ok: false, reason: "bad_vin" });
    expect(called).toBe(false);
  });
  it("returns the facts on 200 and calls the VIN path", async () => {
    let url = "";
    const r = await lookupVin(VIN.toLowerCase(), {
      ...opts,
      fetcher: ((u: string) => ((url = u), res(200, fixture))) as unknown as typeof fetch,
    });
    expect(url).toBe(`https://example.test/v1/vins/${VIN}`);
    expect(r.ok).toBe(true);
  });
  it("maps 404 to not_found and anything else to unavailable", async () => {
    expect(await lookupVin(VIN, { ...opts, fetcher: (() => res(404)) as typeof fetch })).toEqual({ ok: false, reason: "not_found" });
    expect(await lookupVin(VIN, { ...opts, fetcher: (() => res(500)) as typeof fetch })).toEqual({ ok: false, reason: "unavailable" });
    expect(await lookupVin(VIN, { ...opts, fetcher: (() => Promise.reject(new Error("timeout"))) as typeof fetch })).toEqual({ ok: false, reason: "unavailable" });
  });
  it("is unavailable without configuration", async () => {
    expect(await lookupVin(VIN, { baseUrl: "", apiKey: "" })).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("allowVin", () => {
  it("limits each address per hour", () => {
    const t0 = 5_000_000;
    for (let i = 0; i < VIN_PER_HOUR; i += 1) expect(allowVin("x", t0 + i)).toBe(true);
    expect(allowVin("x", t0 + 100)).toBe(false);
    expect(allowVin("y", t0 + 100)).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `cd lowkey/app && npx vitest run lib/vin.test.ts`
Expected: fails because `./vin` doesn't exist.

- [ ] **Step 3: Implement `lib/vin.ts`**

```ts
/**
 * The VIN lookup (task 057): the car's facts from the listings
 * provider's VIN endpoint. A VIN is checked in code before any call is
 * billed; only the facts the quote uses are kept; responses are cached
 * for 6 hours by the Next.js fetch cache (the same promise as listings).
 */

import { vinCheckOk } from "./quote/schema";

export interface VinFacts {
  vin: string;
  status: "active" | "sold" | "missing";
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  msrp: number | null;
  listedPrice: number | null;
  miles: number | null;
  dealerName: string | null;
}

export type VinLookup =
  | { ok: true; facts: VinFacts }
  | { ok: false; reason: "bad_vin" | "not_found" | "unavailable" | "resting" };

const REVALIDATE_SECONDS = 6 * 60 * 60;
const WINDOW_MS = 60 * 60 * 1000;
export const VIN_PER_HOUR = 20;
export const VIN_DAILY_CAP = 300;
const hits = new Map<string, number[]>();
let day = { key: "", count: 0 };

const str = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null);

export function mapVinResponse(body: unknown): VinFacts | null {
  const d = (body as { data?: Record<string, unknown> } | null)?.data;
  if (!d || typeof d.vin !== "string") return null;
  const status = d.status === "active" || d.status === "sold" || d.status === "missing" ? d.status : null;
  if (!status) return null;
  const b = (d.build ?? {}) as Record<string, unknown>;
  const l = (d.latest_listing ?? {}) as Record<string, unknown>;
  const dealer = (l.dealer ?? {}) as Record<string, unknown>;
  const year = num(b.year);
  return {
    vin: d.vin.toUpperCase(),
    status,
    year: year !== null ? Math.round(year) : null,
    make: str(b.make),
    model: str(b.model),
    trim: str(b.trim),
    msrp: num(b.combined_msrp) ?? num(b.base_msrp),
    listedPrice: num(l.price),
    miles: num(l.miles) !== null ? Math.round(num(l.miles)!) : null,
    dealerName: str(dealer.name),
  };
}

/** Best-effort per-address window plus a daily ceiling (per server instance). */
export function allowVin(key: string, now = Date.now()): boolean {
  const today = new Date(now).toISOString().slice(0, 10);
  if (day.key !== today) day = { key: today, count: 0 };
  if (day.count >= VIN_DAILY_CAP) return false;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= VIN_PER_HOUR) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  day.count += 1;
  return true;
}

export async function lookupVin(
  vin: string,
  opts: { fetcher?: typeof fetch; baseUrl?: string; apiKey?: string } = {},
): Promise<VinLookup> {
  const v = vin.trim().toUpperCase();
  if (!vinCheckOk(v)) return { ok: false, reason: "bad_vin" };
  const baseUrl = opts.baseUrl ?? process.env.LOWKEY_PROVIDER_BASE_URL;
  const apiKey = opts.apiKey ?? process.env.LOWKEY_PROVIDER_KEY;
  if (!baseUrl || !apiKey) return { ok: false, reason: "unavailable" };
  const fetcher = opts.fetcher ?? fetch;
  try {
    const res = await fetcher(`${baseUrl.replace(/\/$/, "")}/vins/${v}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(5000),
    } as RequestInit);
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const facts = mapVinResponse(await res.json());
    return facts ? { ok: true, facts } : { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/vin.test.ts`
Expected: PASS. If the fixture import fails, add `"resolveJsonModule": true` to `tsconfig.json` (check first: `grep resolveJsonModule tsconfig.json`).

- [ ] **Step 5: Add the route**

```ts
// lowkey/app/app/api/vin/route.ts
import { clientKey } from "@/lib/quote/reader";
import { getTable, resolveTablePick } from "@/lib/table";
import { allowVin, lookupVin } from "@/lib/vin";

export const maxDuration = 10;

/** The car's facts for a VIN, plus its model's resale history when Low Key has one. */
export async function GET(req: Request) {
  const vin = new URL(req.url).searchParams.get("vin") ?? "";
  if (!allowVin(clientKey(req))) return Response.json({ ok: false, reason: "resting" }, { status: 429 });
  const result = await lookupVin(vin);
  if (!result.ok) return Response.json(result, { status: result.reason === "bad_vin" ? 400 : 200 });
  let retention = null;
  try {
    const { make, model } = result.facts;
    const hit = model ? resolveTablePick(await getTable(), make ? `${make} ${model}` : model) : undefined;
    if (hit) {
      retention = {
        retention5y: hit.pick.retentionAfterDiscount,
        byAge: hit.pick.retentionByAge ?? null,
        slopePerYear: hit.pick.retentionSlopePerYear ?? null,
      };
    }
  } catch {
    retention = null; // the typical curve applies, and the screen says so
  }
  return Response.json({ ...result, retention });
}
```
`retentionByAge` and `retentionSlopePerYear` don't exist on `TablePick` until Task 4. If you run this task first, add the two optional fields to `TablePick` now (exactly as Task 4 Step 5 shows) so the build passes.

- [ ] **Step 6: Build and commit**

```bash
npm run build 2>&1 | grep -E "error|Compiled" ; npm test 2>&1 | grep -E "Tests|FAIL"
cd ~/cv-meta-hackathon-2026 && .venv/bin/python scripts/name_guard.py && .venv/bin/python scripts/secret_guard.py --all
git add lowkey/app/lib/vin.ts lowkey/app/lib/vin.test.ts lowkey/app/app/api/vin/route.ts lowkey/app/lib/table.ts
git commit -m "057: the VIN lookup and its route

Assisted-by: agent"
```

---

### Task 4: Store each model's age points in the table

**Files:**
- Modify: `lowkey/preflight/lineup.py` (`ModelFit`, `Pick`, the fits join around line 258, `Pick(` around line 173, `lineup_to_dict`)
- Modify: `lowkey/pipeline/build_table.py` (`_pick_out`)
- Modify: `lowkey/app/lib/table.ts` (`TablePick`)
- Test: `lowkey/preflight/test_lineup.py`

**Interfaces:**
- Produces: table picks carry `retentionByAge: Record<string, number> | null` (sold price ÷ new price, ages with ≥ 30 sales) and `retentionSlopePerYear: number | null` (the log-linear fit's slope).

- [ ] **Step 1: Write the failing test** (append to `test_lineup.py`, following its existing imports)

```python
def test_age_points_reach_the_table_dict() -> None:
    analysis = {
        "models": {
            c: {} for c in lineup.CATEGORIES
        }
    }
    analysis["models"]["Sedan"]["Corolla"] = {
        "new_price": 24000.0,
        "fit": {"retention_5y": 0.62, "slope_per_year": -0.09},
        "ages": {
            "1": {"count": 120, "ret_new": 0.86},
            "2": {"count": 90, "ret_new": 0.79},
            "3": {"count": 12, "ret_new": 0.70},
        },
    }
    fits = lineup.join_fits(analysis, {"Sedan": {"Corolla": "Toyota"}})
    m = next(f for f in fits["Sedan"] if f.model == "Corolla")
    assert m.ret_by_age == {1: 0.86, 2: 0.79}  # age 3 has fewer than 30 sales
    assert m.slope_per_year == -0.09
```
Before writing it, run `grep -n "^def " lowkey/preflight/lineup.py` to get the exact name of the function that starts `analysis: dict, make_map: dict[str, dict[str, str]]` (around line 250), and use that name in place of `join_fits`.

- [ ] **Step 2: Run it to confirm it fails**

Run: `.venv/bin/python -m pytest lowkey/preflight/test_lineup.py -q`
Expected: fails with `AttributeError: 'ModelFit' object has no attribute 'ret_by_age'`.

- [ ] **Step 3: Add the fields and carry them through**

In `ModelFit` and in `Pick` (both frozen dataclasses), add at the end:
```python
    ret_by_age: dict[int, float] = field(default_factory=dict)  # task 057: sold ÷ new price, ages with >= 30 sold
    slope_per_year: float | None = None  # task 057: the log-linear fit's slope
```
In the join, add to `ModelFit(...)`:
```python
                    ret_by_age={
                        int(a): v["ret_new"]
                        for a, v in entry["ages"].items()
                        if v.get("ret_new") and v["count"] >= 30
                    },
                    slope_per_year=fit.get("slope_per_year"),
```
In `return Pick(...)`, add `ret_by_age=dict(sorted(m.ret_by_age.items())), slope_per_year=m.slope_per_year,`. In `pick_dict`, add:
```python
            "retention_by_age": {str(a): round(r, 4) for a, r in p.ret_by_age.items()},
            "retention_slope_per_year": round(p.slope_per_year, 5) if p.slope_per_year is not None else None,
```

- [ ] **Step 4: Map them in `build_table._pick_out`**

Add to the returned dict:
```python
        "retentionByAge": raw.get("retention_by_age") or None,
        "retentionSlopePerYear": raw.get("retention_slope_per_year"),
```

- [ ] **Step 5: Add them to `TablePick` in `table.ts`** (after `lifespanAsOf`)

```ts
  /** Task 057: sold price ÷ new price by age in years (ages with ≥ 30 sales); null on older tables. */
  retentionByAge?: Record<string, number> | null;
  /** Task 057: the per-year slope of log(retention) from the same fit. */
  retentionSlopePerYear?: number | null;
```

- [ ] **Step 6: Test, rebuild from cache, check, upload**

```bash
cd ~/cv-meta-hackathon-2026 && .venv/bin/python -m pytest -q lowkey/preflight lowkey/pipeline
set -a; . ~/.config/low-key/env; set +a
~/.cache/low-key/venv-timestral/bin/python lowkey/pipeline/build_table.py --skip-forecast 2>&1 | tail -5
python3 -c "import json;t=json.load(open('/home/ndgold/.cache/low-key/table.json'));p=t['lineups']['Sedan']['picks'][0];print(p['model'],p['retentionByAge'],p['retentionSlopePerYear'])"
node lowkey/pipeline/check_table.mjs ~/.cache/low-key/table.json
```
Expected: no `--refresh-provider`, so 0 provider calls. The first sedan pick prints age points such as `{'1': 0.86, ...}` and a negative slope, and `check_table.mjs` passes. If `--skip-forecast` drops the gas forecast that production uses, run without it (the forecast is local compute, not the provider). Then `node lowkey/pipeline/upload_table.mjs`. Older code reads the new table fine, since both fields are optional.

- [ ] **Step 7: Commit**

```bash
git add lowkey/preflight/lineup.py lowkey/preflight/test_lineup.py lowkey/pipeline/build_table.py lowkey/app/lib/table.ts
git commit -m "057: keep each model's sold-price ratio by age in the table

Assisted-by: agent"
```

---

### Task 5: Fit the mileage weight once

**Files:**
- Create: `lowkey/pipeline/mileage_weight.py`, `lowkey/pipeline/test_mileage_weight.py`
- Create: `lowkey/app/lib/mileage-weight.json` (the fit's output)

**Interfaces:**
- Consumes: `provider_client.get` (`lowkey/preflight/provider_client.py`, disk-cached), `provider_client.usage()`, and the analysis report `~/.cache/low-key/preflight/analysis.json` (per-model `fit.slope_per_year`).
- Produces: `mileage-weight.json` = `{"weight": float, "accepted": bool, "cells": int, "median": float|null, "iqr": [float, float]|null, "rule": str, "asOf": "YYYY-MM-DD"}`. `weight` is 0 when not accepted.

- [ ] **Step 1: Write the failing tests for the pure maths**

```python
# lowkey/pipeline/test_mileage_weight.py
import math

from mileage_weight import cell_weight, decide


def test_cell_weight_matches_the_formula():
    # 2-year-old car: typical 24k; halves at 18k and 30k (midpoints), a 12k gap = 1 typical year.
    # Low half sells for e^0.09 more; slope -0.09/yr -> 12k extra miles = 1 extra year -> w = 1.
    w = cell_weight(p_low=10_000 * math.exp(0.09), p_high=10_000, slope=-0.09, m_low=18_000, m_high=30_000)
    assert abs(w - 1.0) < 1e-9


def test_cell_weight_none_for_flat_slope_or_bad_prices():
    assert cell_weight(11_000, 10_000, 0.0, 18_000, 30_000) is None
    assert cell_weight(None, 10_000, -0.09, 18_000, 30_000) is None


def test_decide_accepts_a_tight_positive_set():
    out = decide([0.5, 0.6, 0.7, 0.55, 0.65, 0.6, 0.62, 0.58])
    assert out["accepted"] and abs(out["weight"] - 0.6) < 0.01


def test_decide_rejects_too_few_cells_or_out_of_range():
    assert decide([0.6] * 7)["accepted"] is False
    assert decide([2.0] * 9)["accepted"] is False
    assert decide([-0.5, 0.6, -0.4, 0.7, -0.3, 0.5, 0.6, -0.2])["accepted"] is False
    assert decide([0.6] * 7)["weight"] == 0
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `cd ~/cv-meta-hackathon-2026 && .venv/bin/python -m pytest lowkey/pipeline/test_mileage_weight.py -q`
Expected: fails with `ModuleNotFoundError: mileage_weight`.

- [ ] **Step 3: Implement**

```python
"""Fit the used-car mileage weight once (task 057).

w says how far extra miles move a car along its model's age curve:
effective age = age + w * (odometer - 12000 * age) / 12000.

For ages 2, 3 and 4 it reads sold used units (last 90 days) split into
miles below and above typical (two facet calls per age, each over all
models at once), and for every (model, age) cell with at least 10 sales
in both halves computes

    w = (log(P_low / P_high) / |slope|) / ((M_high - M_low) / 12000)

with the model's fitted yearly slope of log(retention). The rule below
was fixed before the fit ran; if it fails, w = 0 (age only).

    set -a; . ~/.config/low-key/env; set +a
    python lowkey/pipeline/mileage_weight.py
"""

import json
import math
import statistics
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "lowkey" / "preflight"))

ANALYSIS = Path.home() / ".cache" / "low-key" / "preflight" / "analysis.json"
OUT = ROOT / "lowkey" / "app" / "lib" / "mileage-weight.json"
CURRENT_YEAR = 2026
AGES = (2, 3, 4)
TYPICAL = 12_000
MIN_SOLD = 10
RULE = "accept if >= 8 cells, median w in [0.1, 1.5], and the cells' IQR above 0; else w = 0 (age only)"


def cell_weight(p_low, p_high, slope, m_low, m_high) -> float | None:
    if not p_low or not p_high or p_low <= 0 or p_high <= 0 or slope is None or slope >= 0:
        return None
    if m_high <= m_low:
        return None
    years = math.log(p_low / p_high) / abs(slope)
    return years / ((m_high - m_low) / TYPICAL)


def decide(weights: list[float]) -> dict:
    out = {"weight": 0, "accepted": False, "cells": len(weights), "median": None, "iqr": None, "rule": RULE}
    if len(weights) < 8:
        return out
    med = statistics.median(weights)
    q = statistics.quantiles(weights, n=4)
    out.update(median=round(med, 4), iqr=[round(q[0], 4), round(q[2], 4)])
    if 0.1 <= med <= 1.5 and q[0] > 0:
        out.update(weight=round(med, 4), accepted=True)
    return out


def _median_by_model(body: dict) -> dict[str, tuple[int, float | None]]:
    rows = body.get("data", {}).get("facets", {}).get("model") or []
    out = {}
    for r in rows:
        price = (r.get("metrics", {}).get("price.median") or {}).get("value")
        out[r.get("value")] = (int(r.get("count") or 0), float(price) if price is not None else None)
    return out


def main() -> None:
    import provider_client

    analysis = json.loads(ANALYSIS.read_text())
    slopes = {
        model: (entry.get("fit") or {}).get("slope_per_year")
        for models in analysis["models"].values()
        for model, entry in models.items()
    }
    before = provider_client.usage()
    weights: list[float] = []
    for age in AGES:
        typ = TYPICAL * age
        halves = {"low": (typ // 2, typ), "high": (typ, typ + typ // 2)}
        got = {}
        for half, (lo, hi) in halves.items():
            got[half] = _median_by_model(
                provider_client.get(
                    "/facets",
                    {
                        "facets": "model",
                        "inventory_status": "sold",
                        "inventory_type": "used",
                        "year": str(CURRENT_YEAR - age),
                        "sold_within_days": "90",
                        "min_mileage": str(lo),
                        "max_mileage": str(hi),
                        "metrics": "price.median",
                        "facet_value_limit": "200",
                    },
                )
            )
        m_low, m_high = (typ // 2 + typ) / 2, (typ + typ + typ // 2) / 2
        for model, (n_low, p_low) in got["low"].items():
            n_high, p_high = got["high"].get(model, (0, None))
            if n_low < MIN_SOLD or n_high < MIN_SOLD:
                continue
            w = cell_weight(p_low, p_high, slopes.get(model), m_low, m_high)
            if w is not None:
                weights.append(w)
    result = decide(weights) | {"asOf": date.today().isoformat()}
    OUT.write_text(json.dumps(result, indent=1) + "\n")
    after = provider_client.usage()
    print(json.dumps(result, indent=1))
    print("usage before/after:", json.dumps(before), json.dumps(after))


if __name__ == "__main__":
    main()
```
Note: the tests import `mileage_weight` from `lowkey/pipeline`. Check that pytest's rootdir puts the pipeline folder on the path, as the existing `test_trim.py` does with `import trim`. If not, add the same `sys.path` line that file uses.

- [ ] **Step 4: Run the tests**

Run: `.venv/bin/python -m pytest lowkey/pipeline/test_mileage_weight.py -q`
Expected: PASS.

- [ ] **Step 5: Run the fit once (about 6 provider calls)**

Run: `set -a; . ~/.config/low-key/env; set +a; .venv/bin/python lowkey/pipeline/mileage_weight.py`
Expected: the JSON result and the usage totals before and after. Spend must be under $1. **Do not change `RULE` or the thresholds after seeing the result.** An unaccepted fit is a valid outcome (w = 0), and the report says so.

- [ ] **Step 6: Commit**

```bash
.venv/bin/python scripts/name_guard.py && .venv/bin/python scripts/secret_guard.py --all
git add lowkey/pipeline/mileage_weight.py lowkey/pipeline/test_mileage_weight.py lowkey/app/lib/mileage-weight.json
git commit -m "057: fit the used-car mileage weight from sold data

Assisted-by: agent"
```

---

### Task 6: The used-car curve, `ownershipMath`'s hook, and the fee lump

**Files:**
- Create: `lowkey/app/lib/used.ts`, `lowkey/app/lib/used.test.ts`
- Modify: `lowkey/app/lib/ownership.ts` (`OwnershipInput` and `ownershipMath`, lines 33–46 and 139–175)
- Modify: `lowkey/app/lib/quote/compare.ts` (`priceDeal`, `analyzeQuote`, `QuoteAnalysis`)
- Test: `lowkey/app/lib/quote/compare.test.ts` (append)

**Interfaces:**
- Consumes: `mileage-weight.json` (Task 5); `retention` from `/api/vin` (Task 3) and the table fields (Task 4).
- Produces:
```ts
// used.ts
export const TYPICAL_MILES_PER_YEAR = 12000;
export const MILEAGE_WEIGHT: number;            // from mileage-weight.json (0 when not accepted)
export interface AgeCurve { byAge: Record<string, number>; slopePerYear: number }
export function curveValue(c: AgeCurve, ageYears: number): number;
export function effectiveAge(ageYears: number, odometer: number, w?: number): number;
export function usedResaleFactor(c: AgeCurve, aEff: number): (tMonths: number) => number;
export function isNewCar(ageYears: number, odometer: number | null): boolean;
export type UsedBasis = "new" | "used-age-miles" | "used-age" | "used-typical";
export function usedRetention(args: {
  buildYear: number | null; odometer: number | null; nowYear: number;
  retention: { retention5y: number; byAge: Record<string, number> | null; slopePerYear: number | null } | null;
}): { retention5y: number; resaleFactor?: (t: number) => number; basis: UsedBasis };
// ownership.ts: OwnershipInput.resaleFactor?: (tMonths: number) => number
// compare.ts: analyzeQuote(q, terms, retention?: { retention5y: number; resaleFactor?: (t: number) => number; basis?: UsedBasis } | null)
//             QuoteAnalysis gains feesLump: number | null and resaleBasis: UsedBasis
```

- [ ] **Step 1: Write the failing tests**

```ts
// lowkey/app/lib/used.test.ts
import { describe, expect, it } from "vitest";

import { ownershipMath } from "./ownership";
import { curveValue, effectiveAge, isNewCar, usedResaleFactor, usedRetention } from "./used";

const curve = { byAge: { "1": 0.86, "2": 0.79, "3": 0.72 }, slopePerYear: -0.09 };

describe("curveValue", () => {
  it("is 1 when new and hits the stored points", () => {
    expect(curveValue(curve, 0)).toBe(1);
    expect(curveValue(curve, 2)).toBeCloseTo(0.79, 10);
  });
  it("interpolates log-linearly between points", () => {
    expect(curveValue(curve, 1.5)).toBeCloseTo(Math.sqrt(0.86 * 0.79), 10);
  });
  it("extrapolates past the last point with the slope", () => {
    expect(curveValue(curve, 4)).toBeCloseTo(0.72 * Math.exp(-0.09), 10);
  });
  it("never rises with age, even on noisy points", () => {
    const noisy = { byAge: { "1": 0.8, "2": 0.83, "3": 0.7 }, slopePerYear: -0.1 };
    expect(curveValue(noisy, 2)).toBeLessThanOrEqual(curveValue(noisy, 1));
  });
});

describe("effectiveAge", () => {
  it("moves a high-mileage car further along", () => {
    expect(effectiveAge(2, 24000, 0.5)).toBe(2);
    expect(effectiveAge(2, 36000, 0.5)).toBe(2.5);
    expect(effectiveAge(2, 0, 0.5)).toBe(1);
    expect(effectiveAge(0, 0, 0.5)).toBe(0);
  });
  it("is the age when w is 0", () => {
    expect(effectiveAge(3, 90000, 0)).toBe(3);
  });
});

describe("usedResaleFactor", () => {
  it("is 1 at month 0 and loses less later in life", () => {
    const young = usedResaleFactor(curve, 0.5);
    const old = usedResaleFactor(curve, 3);
    expect(young(0)).toBe(1);
    expect(old(12)).toBeGreaterThan(0);
    expect(old(12)).toBeLessThanOrEqual(1);
  });
  it("more miles never raise resale", () => {
    const a = usedResaleFactor(curve, effectiveAge(2, 20000, 0.5))(24);
    const b = usedResaleFactor(curve, effectiveAge(2, 40000, 0.5))(24);
    expect(b).toBeLessThanOrEqual(a + 1e-12);
  });
});

describe("usedRetention", () => {
  const retention = { retention5y: 0.55, byAge: curve.byAge, slopePerYear: -0.09 };
  it("a new car keeps today's path exactly", () => {
    const r = usedRetention({ buildYear: 2026, odometer: 12, nowYear: 2026, retention });
    expect(r.basis).toBe("new");
    expect(r.resaleFactor).toBeUndefined();
    const a = ownershipMath({ price: 30000, retention5y: 0.55 });
    const b = ownershipMath({ price: 30000, retention5y: r.retention5y, resaleFactor: r.resaleFactor });
    expect(b).toEqual(a);
  });
  it("a used car with points gets a curve", () => {
    const r = usedRetention({ buildYear: 2023, odometer: 40000, nowYear: 2026, retention });
    expect(r.resaleFactor).toBeDefined();
    expect(["used-age-miles", "used-age"]).toContain(r.basis);
  });
  it("a used car without points falls back to the typical curve, labelled", () => {
    const r = usedRetention({ buildYear: 2023, odometer: 40000, nowYear: 2026, retention: { retention5y: 0.55, byAge: null, slopePerYear: null } });
    expect(r.basis).toBe("used-typical");
    expect(r.resaleFactor).toBeUndefined();
  });
  it("is new without a build year", () => {
    expect(isNewCar(0, null)).toBe(true);
    expect(isNewCar(1, 5000)).toBe(false);
    expect(isNewCar(0, 3000)).toBe(false);
  });
});
```
Append to `compare.test.ts` (use its existing imports and its quote-building helper, if it has one; otherwise `emptyQuote()`):
```ts
describe("terms reads (task 057)", () => {
  it("shows fees as one signed lump and never flags a total gap", () => {
    const q = { ...emptyQuote(), source: "photo" as const, readMode: "terms" as const, sellingPrice: 28000, outTheDoor: 30500 };
    const r = analyzeQuote(q, { downRule: { kind: "share", share: 0.1 }, aprPercent: 7, termMonths: 60 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.analysis.feesLump).toBe(2500);
    expect(r.analysis.totalGap).toBeNull();
  });
  it("a rebate makes the lump negative", () => {
    const q = { ...emptyQuote(), source: "photo" as const, readMode: "terms" as const, sellingPrice: 28000, outTheDoor: 27000 };
    const r = analyzeQuote(q, { downRule: { kind: "share", share: 0.1 }, aprPercent: 7, termMonths: 60 });
    expect(r.ok && r.analysis.feesLump).toBe(-1000);
  });
  it("an itemized quote has no lump", () => {
    const q = { ...emptyQuote(), sellingPrice: 28000, outTheDoor: 30500 };
    const r = analyzeQuote(q, { downRule: { kind: "share", share: 0.1 }, aprPercent: 7, termMonths: 60 });
    expect(r.ok && r.analysis.feesLump).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `cd lowkey/app && npx vitest run lib/used.test.ts lib/quote/compare.test.ts`
Expected: fails because `./used` doesn't exist and `readMode`/`feesLump` are unknown. Task 8 adds `readMode` to the Quote schema; add it here now as `readMode: z.enum(["full", "terms"]).optional(),` in `quoteSchema`, so this task builds.

- [ ] **Step 3: Implement `lib/used.ts`**

```ts
/**
 * Used-car resale (task 057). A model's sold-price ratio by age
 * (from the table) gives a curve whose loss slows with age; a used car
 * sits on it at an effective age from its age and its miles. The weight
 * w comes from one fit on sold data (mileage-weight.json); when that
 * fit was not accepted, w is 0 and the car is placed by age alone.
 */

import weightFile from "./mileage-weight.json";

export const TYPICAL_MILES_PER_YEAR = 12000;
export const MILEAGE_WEIGHT: number =
  (weightFile as { accepted?: boolean; weight?: number }).accepted ? Number(weightFile.weight) || 0 : 0;

export interface AgeCurve {
  byAge: Record<string, number>;
  slopePerYear: number;
}
export type UsedBasis = "new" | "used-age-miles" | "used-age" | "used-typical";

function points(c: AgeCurve): [number, number][] {
  const pts = Object.entries(c.byAge)
    .map(([a, r]) => [Number(a), r] as [number, number])
    .filter(([a, r]) => a > 0 && r > 0 && r <= 1.5)
    .sort((x, y) => x[0] - y[0]);
  // V(0) = 1, then never rising: noisy sold medians can't make a car gain value with age.
  const out: [number, number][] = [[0, 0]];
  for (const [a, r] of pts) out.push([a, Math.min(Math.log(r), out[out.length - 1][1])]);
  return out;
}

/** V(age): log-linear between stored ages, the fitted slope past the last one. */
export function curveValue(c: AgeCurve, ageYears: number): number {
  if (ageYears <= 0) return 1;
  const pts = points(c);
  for (let i = 1; i < pts.length; i += 1) {
    const [a1, l1] = pts[i];
    if (ageYears <= a1) {
      const [a0, l0] = pts[i - 1];
      return Math.exp(l0 + ((l1 - l0) * (ageYears - a0)) / (a1 - a0));
    }
  }
  const [aLast, lLast] = pts[pts.length - 1];
  return Math.exp(lLast + Math.min(0, c.slopePerYear) * (ageYears - aLast));
}

export function effectiveAge(ageYears: number, odometer: number, w = MILEAGE_WEIGHT): number {
  const age = Math.max(0, ageYears);
  return Math.max(0, age + (w * (odometer - TYPICAL_MILES_PER_YEAR * age)) / TYPICAL_MILES_PER_YEAR);
}

/** Resale ÷ purchase-price basis after t months (miles keep adding at the typical rate). */
export function usedResaleFactor(c: AgeCurve, aEff: number): (tMonths: number) => number {
  const v0 = curveValue(c, aEff);
  return (t: number) => Math.min(1, curveValue(c, aEff + Math.max(0, t) / 12) / v0);
}

export function isNewCar(ageYears: number, odometer: number | null): boolean {
  return ageYears <= 0 && (odometer ?? 0) < 1000;
}

export function usedRetention(args: {
  buildYear: number | null;
  odometer: number | null;
  nowYear: number;
  retention: { retention5y: number; byAge: Record<string, number> | null; slopePerYear: number | null } | null;
}): { retention5y: number; resaleFactor?: (t: number) => number; basis: UsedBasis } {
  const retention5y = args.retention?.retention5y ?? 0.6;
  const age = args.buildYear !== null ? Math.max(0, args.nowYear - args.buildYear) : 0;
  if (isNewCar(age, args.odometer)) return { retention5y, basis: "new" };
  const r = args.retention;
  if (!r?.byAge || Object.keys(r.byAge).length === 0 || r.slopePerYear === null) {
    return { retention5y, basis: "used-typical" };
  }
  const curve = { byAge: r.byAge, slopePerYear: r.slopePerYear };
  const odometer = args.odometer ?? TYPICAL_MILES_PER_YEAR * age;
  const aEff = effectiveAge(age, odometer);
  return {
    retention5y,
    resaleFactor: usedResaleFactor(curve, aEff),
    basis: MILEAGE_WEIGHT > 0 && args.odometer !== null ? "used-age-miles" : "used-age",
  };
}
```
`0.6` is `DEFAULT_RETENTION_5Y`; import it from `./ownership` instead of the literal if that causes no import cycle (`ownership.ts` must not import `used.ts`).

- [ ] **Step 4: Add the hook to `ownershipMath`**

In `OwnershipInput`, add:
```ts
  /** Task 057: a used car's resale ÷ price after t months (before the trade-in step); absent for new cars. */
  resaleFactor?: (tMonths: number) => number;
```
In `ownershipMath`, after `const payment = …`, add:
```ts
  const resaleOf = (month: number) =>
    input.resaleFactor && month > 0
      ? price * TRADE_IN_FACTOR * input.resaleFactor(month)
      : resaleAt(price, retention5y, month);
```
and replace both `resaleAt(price, retention5y, month)` (inside `pointAt`) and `resaleAt(price, retention5y, m)` (in the curve loop) with `resaleOf(month)` and `resaleOf(m)`. Run `grep -n "resaleAt(price" lib/ownership.ts` afterwards: no line may remain except the one inside `resaleOf`. Since `resaleAt(price, _, 0)` already equals `price * TRADE_IN_FACTOR`, month 0 is unchanged.

- [ ] **Step 5: Pass it through `compare.ts` and add the lump**

- `priceDeal`'s args gain `resaleFactor?: (t: number) => number`, passed to `ownershipMath({...,resaleFactor: args.resaleFactor})`.
- `analyzeQuote`'s third parameter becomes `retention?: { retention5y: number; resaleFactor?: (t: number) => number; basis?: UsedBasis } | null` (import `type UsedBasis` from `../used`).
- Pass `resaleFactor: retention?.resaleFactor` to both `priceDeal` calls.
- Add to `QuoteAnalysis`:
```ts
  /** Task 057: out-the-door − price on a terms read (taxes, fees and adjustments; negative with a rebate), else null. */
  feesLump: number | null;
  resaleBasis: UsedBasis;
```
After `totalGap` is computed, add:
```ts
  const lumpMode = q.readMode === "terms" && q.fees.length === 0 && q.outTheDoor !== null && q.sellingPrice !== null;
  const feesLump = lumpMode ? round2((q.outTheDoor as number) - (q.sellingPrice as number)) : null;
```
and change the `totalGap` definition so a lump never flags a gap: wrap the existing expression as `const totalGap = lumpMode ? null : (<existing expression>)`. Move the `lumpMode` line above `totalGap`. Add `feesLump, resaleBasis: retention?.basis ?? "new"` to the returned analysis object.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run && npm run build 2>&1 | grep -E "error|Compiled"`
Expected: every test passes (280 old plus the new ones), and the build compiles. A failing old ownership or compare test means `resaleOf` changed new-car output; fix the code, not the test.

- [ ] **Step 7: Commit**

```bash
git add lowkey/app/lib/used.ts lowkey/app/lib/used.test.ts lowkey/app/lib/ownership.ts lowkey/app/lib/quote/compare.ts lowkey/app/lib/quote/compare.test.ts lowkey/app/lib/quote/schema.ts
git commit -m "057: a used-car resale curve by age and miles, and the fee lump

Assisted-by: agent"
```

---

### Task 7: Decode a VIN barcode in the browser

**Files:**
- Modify: `lowkey/app/package.json` (dependency and `prebuild`)
- Create: `lowkey/app/scripts/copy-zxing-wasm.mjs`; add `public/zxing_reader.wasm` to `lowkey/app/.gitignore`
- Create: `lowkey/app/lib/quote/barcode.ts`, `lowkey/app/lib/quote/barcode.test.ts`

**Interfaces:**
- Produces: `vinFromBarcodeText(text: string): string | null` (pure) and `decodeVin(file: Blob): Promise<string | null>` (browser; lazy-loads zxing and never throws).

- [ ] **Step 1: Install and confirm the API**

```bash
cd ~/cv-meta-hackathon-2026/lowkey/app && npm install --save-exact zxing-wasm@3.1.6
node -e "import('zxing-wasm/reader').then(m=>console.log(Object.keys(m)))"
node -e "import('zxing-wasm/full').then(m=>console.log(Object.keys(m)))"
```
Expected: the reader exports include `readBarcodes` and `prepareZXingModule`, and the full build includes `writeBarcode`. If the names differ, use the printed names everywhere below.

- [ ] **Step 2: Write the failing tests**

```ts
// lowkey/app/lib/quote/barcode.test.ts
import { describe, expect, it } from "vitest";

import { vinFromBarcodeText } from "./barcode";

const VIN = "1HGCV2FA9SB601815";

describe("vinFromBarcodeText", () => {
  it("accepts a plain VIN", () => expect(vinFromBarcodeText(VIN)).toBe(VIN));
  it("drops the leading I some Code 39 VIN labels carry", () => expect(vinFromBarcodeText(`I${VIN}`)).toBe(VIN));
  it("finds the VIN inside a longer payload", () => expect(vinFromBarcodeText(`XX ${VIN} 2026`)).toBe(VIN));
  it("rejects a VIN whose check digit fails", () => expect(vinFromBarcodeText("1HGCV2FA0SB601815")).toBeNull());
  it("rejects noise", () => expect(vinFromBarcodeText("hello")).toBeNull());
});

describe("decodeVin on a generated barcode", () => {
  it("reads a Code 39 VIN", async () => {
    const { writeBarcode, readBarcodes } = await import("zxing-wasm/full");
    const written = await writeBarcode(VIN, { format: "Code39", scale: 2 });
    expect(written.image).toBeTruthy();
    const read = await readBarcodes(written.image as Blob, { formats: ["Code39"] });
    expect(vinFromBarcodeText(read[0]?.text ?? "")).toBe(VIN);
  });
});
```

- [ ] **Step 3: Run them to confirm they fail**

Run: `npx vitest run lib/quote/barcode.test.ts`
Expected: fails because `./barcode` doesn't exist.

- [ ] **Step 4: Implement**

```ts
// lowkey/app/lib/quote/barcode.ts
/**
 * VIN from a barcode (task 057): window stickers and door jambs carry
 * the VIN as a Code 39, Code 128, Data Matrix or QR code. Decoding runs
 * on the device; the image is never sent anywhere for this step.
 */

import { vinCheckOk } from "./schema";

/** The first 17-character run whose check digit holds, or null. */
export function vinFromBarcodeText(text: string): string | null {
  const s = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (let i = 0; i + 17 <= s.length; i += 1) {
    const cand = s.slice(i, i + 17);
    if (vinCheckOk(cand)) return cand;
  }
  return null;
}

let prepared = false;

export async function decodeVin(file: Blob): Promise<string | null> {
  try {
    const zx = await import("zxing-wasm/reader");
    if (!prepared) {
      zx.prepareZXingModule({
        overrides: {
          locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path),
        },
      });
      prepared = true;
    }
    const results = await zx.readBarcodes(file, {
      formats: ["Code39", "Code128", "DataMatrix", "QRCode"],
      tryHarder: true,
      maxNumberOfSymbols: 4,
    });
    for (const r of results) {
      const vin = vinFromBarcodeText(r.text ?? "");
      if (vin) return vin;
    }
    return null;
  } catch {
    return null; // no barcode path: the read's VIN or a typed one takes over
  }
}
```

- [ ] **Step 5: Copy the wasm at build time**

```js
// lowkey/app/scripts/copy-zxing-wasm.mjs
import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
copyFileSync(require.resolve("zxing-wasm/reader/zxing_reader.wasm"), new URL("../public/zxing_reader.wasm", import.meta.url));
```
In `package.json` scripts, add `"prebuild": "node scripts/copy-zxing-wasm.mjs"`. Add `/public/zxing_reader.wasm` to `lowkey/app/.gitignore`.

- [ ] **Step 6: Run the tests and the build**

Run: `npx vitest run lib/quote/barcode.test.ts && npm run build 2>&1 | grep -E "error|Compiled" && ls -la public/zxing_reader.wasm`
Expected: PASS, the build compiles, and the wasm file exists (about 1 MB). If the generated-barcode test can't load wasm under vitest's node environment, add `// @vitest-environment node` at the top of the file. If it still fails, keep the pure tests and verify decoding in Task 10's headless Chrome run instead, and say so in the report.

- [ ] **Step 7: Commit**

```bash
git add lowkey/app/package.json lowkey/app/package-lock.json lowkey/app/scripts/copy-zxing-wasm.mjs lowkey/app/.gitignore lowkey/app/lib/quote/barcode.ts lowkey/app/lib/quote/barcode.test.ts
git commit -m "057: decode a VIN barcode on the device

Assisted-by: agent"
```

---

### Task 8: The client schema and the read route carry the terms mode

**Files:**
- Modify: `lowkey/app/lib/quote/schema.ts` (`quoteSchema`, `readSchema`, `quoteFromRead`)
- Modify: `lowkey/app/app/api/quote/read/route.ts`
- Test: `lowkey/app/lib/quote/schema.test.ts` (create if absent: `ls lib/quote/schema.test.ts`)

**Interfaces:**
- Consumes: the reader's terms output (Task 2) and `VinFacts` (Task 3).
- Produces: `Quote` gains `readMode?: "full" | "terms"` (added in Task 6) and `car?: { year, make, model, trim, miles, status, source: "vin" } | null`. `quoteFromRead` handles `mode: "terms"`. `POST /api/quote/read` accepts `mode`.

- [ ] **Step 1: Write the failing tests**

```ts
// lowkey/app/lib/quote/schema.test.ts
import { describe, expect, it } from "vitest";

import { quoteFromRead, quoteSchema, emptyQuote } from "./schema";

describe("quoteFromRead, terms mode", () => {
  it("maps a terms read and marks it unconfirmed", () => {
    const q = quoteFromRead({
      doc_type: "terms", mode: "terms", vin: "1HGCV2FA9SB601815", vin_check_ok: true,
      selling_price: 28450, msrp: null, price_basis: "selling", down: 3000, out_the_door: 31204.1,
      stated_monthly: 512.33, apr: 6.9, term_months: 72, mileage: 18420, fees: [], payment_options: [],
    });
    expect(q.readMode).toBe("terms");
    expect(q.mileage).toBe(18420);
    expect(q.sellingPrice).toBe(28450);
    expect(q.unconfirmed).toContain("mileage");
    expect(q.fees).toEqual([]);
  });
  it("uses the MSRP as the price when that is all the sticker shows", () => {
    const q = quoteFromRead({ doc_type: "terms", mode: "terms", selling_price: null, msrp: 27315, price_basis: "msrp" });
    expect(q.sellingPrice).toBe(27315);
    expect(q.priceIsSticker).toBe(true);
  });
  it("old drafts without the new fields still parse", () => {
    // emptyQuote() sets neither readMode nor car, like a draft saved before task 057.
    expect(quoteSchema.safeParse(emptyQuote()).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run lib/quote/schema.test.ts`
Expected: fails because `mode`, `mileage` and `price_basis` aren't read yet.

- [ ] **Step 3: Implement**

In `quoteSchema`, add after `readMode` (from Task 6):
```ts
  /** Task 057: the car from its VIN lookup; null or absent when typed. */
  car: z
    .object({
      year: z.number().int().nullable(),
      make: z.string().max(60).nullable(),
      model: z.string().max(80).nullable(),
      trim: z.string().max(80).nullable(),
      miles: z.number().int().nonnegative().nullable(),
      status: z.enum(["active", "sold", "missing"]),
    })
    .nullable()
    .optional(),
```
In `readSchema`, add:
```ts
  mode: z.enum(["full", "terms"]).optional(),
  mileage: z.number().nullable().optional(),
  price_basis: z.enum(["selling", "msrp"]).nullable().optional(),
```
In `quoteFromRead`, after the existing sticker block, add:
```ts
  if (read.mode === "terms") {
    q.readMode = "terms";
    if (q.sellingPrice === null && q.msrp !== null && read.price_basis === "msrp") {
      q.sellingPrice = q.msrp;
      q.priceIsSticker = true;
    }
    const miles = read.mileage;
    q.mileage = typeof miles === "number" && Number.isFinite(miles) && miles >= 0 && miles < 1_000_000 ? Math.round(miles) : null;
  }
```
and before `q.unconfirmed = filled;`, add `if (q.mileage !== null) filled.push("mileage");`.

In `app/api/quote/read/route.ts`, read the mode and pass it through:
```ts
  let body: { image_b64?: unknown; mime?: unknown; mode?: unknown };
  ...
  const mode = body.mode === "terms" ? "terms" : "full";
  ...
      body: JSON.stringify({ image_b64: image, mime, mode }),
```

- [ ] **Step 4: Run the tests and the build**

Run: `npx vitest run && npm run build 2>&1 | grep -E "error|Compiled"`
Expected: PASS and the build compiles.

- [ ] **Step 5: Commit**

```bash
git add lowkey/app/lib/quote/schema.ts lowkey/app/lib/quote/schema.test.ts lowkey/app/app/api/quote/read/route.ts
git commit -m "057: the quote schema and the read route carry the terms mode

Assisted-by: agent"
```

---

### Task 9: The quote screen runs both tracks

**Files:**
- Modify: `lowkey/app/components/QuoteCheck.tsx`

**Interfaces:**
- Consumes: `decodeVin` (Task 7); `/api/vin` → `{ ok, facts, retention }` (Task 3); `usedRetention` (Task 6); `quoteFromRead` with `readMode`/`car` (Task 8); `feesLump` and `resaleBasis` (Task 6).

- [ ] **Step 1: Car facts state and lookup**

Below the existing `useState` lines, add:
```tsx
  // Task 057: each quote's VIN lookup result (the car and its model's resale history), by quote index.
  const [carInfo, setCarInfo] = useState<Record<number, { facts: VinFacts; retention: VinRetention | null } | "none">>({});
  const lastFile = useRef<File | null>(null);

  const lookupCar = useCallback(async (index: number, vin: string) => {
    try {
      const res = await fetch(`/api/vin?vin=${encodeURIComponent(vin)}`);
      const body = (await res.json()) as { ok: boolean; facts?: VinFacts; retention?: VinRetention | null };
      if (!body.ok || !body.facts) return setCarInfo((c) => ({ ...c, [index]: "none" }));
      const f = body.facts;
      setCarInfo((c) => ({ ...c, [index]: { facts: f, retention: body.retention ?? null } }));
      setQuotes((all) =>
        all.map((x, i) =>
          i === index
            ? {
                ...x,
                vin: f.vin,
                year: x.year ?? f.year,
                vehicle: x.vehicle ?? ([f.make, f.model, f.trim].filter(Boolean).join(" ") || null),
                mileage: x.mileage ?? f.miles,
                car: { year: f.year, make: f.make, model: f.model, trim: f.trim, miles: f.miles, status: f.status },
              }
            : x,
        ),
      );
    } catch {
      setCarInfo((c) => ({ ...c, [index]: "none" }));
    }
  }, []);
```
with the imports `import type { VinFacts } from "@/lib/vin";`, `import { decodeVin } from "@/lib/quote/barcode";` and `import { usedRetention } from "@/lib/used";`, plus a local type:
```tsx
type VinRetention = { retention5y: number; byAge: Record<string, number> | null; slopePerYear: number | null };
```
`lib/vin.ts` must not import server-only code, so its `import type` is safe in a client component. Check that `vin.ts` imports only `./quote/schema`.

- [ ] **Step 2: Start both tracks in `onPhoto`**

Change the signature to `const onPhoto = async (file: File | undefined, mode: "terms" | "full" = "terms") => {`. After `if (!file) return;`, add:
```tsx
    lastFile.current = file;
    const index = active;
    let barcodeVin: string | null = null;
    // Track 1: a VIN barcode, decoded on the device, starts the VIN lookup at once.
    if (mode === "terms" && file.type !== "application/pdf") {
      void decodeVin(file).then((vin) => {
        if (vin && !cancelled.current) {
          barcodeVin = vin;
          void lookupCar(index, vin);
        }
      });
    }
```
In the read request body, send `mode`: `body: JSON.stringify({ image_b64, mime: "image/jpeg", mode })`. Change `POLL_MS` to `1000`. When the read lands, replace the existing `setQuotes(...)` line with:
```tsx
        const read = quoteFromRead(parsed.data);
        setQuotes((all) =>
          all.map((x, i) =>
            i === index ? { ...read, dealerName: x.dealerName, car: x.car, vin: barcodeVin ?? read.vin ?? x.vin } : x,
          ),
        );
        // No barcode: the VIN the read found (check digit already verified) starts the lookup now.
        if (!barcodeVin && read.vin) void lookupCar(index, read.vin);
```
`barcodeVin` is a closure variable that the decode promise sets. If the decode lands after the read, its `lookupCar` call still runs, and the barcode VIN then overwrites the read's VIN through `lookupCar`'s `vin: f.vin`. That is the spec's "barcode wins".

Then add the spec's "The sheet says …" option. Add state `const [sheetVin, setSheetVin] = useState<Record<number, string>>({});`. In the read handler, after `quoteFromRead`, record `read.vin` when it passes the check digit: `if (read.vin) setSheetVin((s) => ({ ...s, [index]: read.vin as string }));`. Under the VIN input, render:
```tsx
            {sheetVin[active] && q.vin && sheetVin[active] !== q.vin ? (
              <Button type="button" variant="link" linkUnderline="static" className="min-h-11 self-start underline underline-offset-2"
                onClick={() => { update({ vin: sheetVin[active] }, ["vin"]); void lookupCar(active, sheetVin[active]); }}>
                The sheet says {sheetVin[active]}. Use that instead
              </Button>
            ) : null}
```

- [ ] **Step 3: Use the car for resale**

Replace the `own` function:
```tsx
  const own = (x: Quote, i: number) => {
    const info = carInfo[i];
    if (info && info !== "none") {
      return usedRetention({
        buildYear: info.facts.year,
        odometer: x.mileage ?? info.facts.miles,
        nowYear: new Date().getFullYear(),
        retention: info.retention,
      });
    }
    const v = (x.vehicle ?? "").toLowerCase();
    const p = v ? picks.find((pk) => v.includes(pk.deal.model.toLowerCase()) || v.includes(pk.label.toLowerCase())) : undefined;
    return p && p.retention5y !== null ? { retention5y: p.retention5y } : null;
  };
```
Update the callers: `analyzeQuote(q, terms, own(q, active))`, `analyzeQuote(x, terms, own(x, i))`, and `headsUp(q, pick.deal, downRule, own(q, active), estTax)`. Check `headsUp`'s parameter type with `grep -n "export function headsUp" -A8 lib/quote/compare.ts`, and widen it to the same `{ retention5y; resaleFactor?; basis? } | null` shape if it's narrower, passing `resaleFactor` to its `priceDeal` calls.

- [ ] **Step 4: Show the car, the mileage and the source**

Directly above the "Dealer (optional)" label inside the form `<section>`, add:
```tsx
          {q.car ? (
            <div className="col-span-2 flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2">
              <Typography variant="paragraph-md" className="font-medium">
                {[q.car.year, q.car.make, q.car.model, q.car.trim].filter(Boolean).join(" ")}
                {q.mileage !== null ? ` · ${q.mileage.toLocaleString("en-US")} mi` : ""}
              </Typography>
              <Typography variant="paragraph-xs" className="text-muted-foreground">
                {q.car.status === "active" ? "From the car's VIN." : "From the car's VIN. This listing is no longer live."}
              </Typography>
            </div>
          ) : carInfo[active] === "none" && q.vin ? (
            <Typography variant="paragraph-xs" className="col-span-2 text-muted-foreground">
              We couldn&apos;t look up this VIN. Type the year, make and model below; the numbers still compare.
            </Typography>
          ) : null}
```
After the VIN field's `</label>`, add a mileage input:
```tsx
          <label className="col-span-2 flex flex-col gap-1">
            <Typography variant="paragraph-xs" className="text-muted-foreground">
              Mileage{q.car?.miles != null && q.mileage === q.car.miles ? " · from the listing" : unconfirmed.has("mileage") ? " · read from your photo, please check" : ""}
            </Typography>
            <Input
              type="text"
              inputMode="numeric"
              value={q.mileage === null ? "" : String(q.mileage)}
              onChange={(e) => {
                const t = e.target.value.replace(/\D/g, "");
                update({ mileage: t === "" ? null : Number(t) }, ["mileage"]);
              }}
              className={fieldClass("mileage")}
            />
          </label>
```
In the VIN field's `onChange`, after `update(...)`, start a lookup when 17 valid characters are typed:
```tsx
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                update({ vin: v || null }, ["vin"]);
                if (vinCheckOk(v)) void lookupCar(active, v);
              }}
```

- [ ] **Step 5: The fee lump and "Read everything"**

Wrap the existing "Fees and add-ons" `<section>` so it renders only when `q.readMode !== "terms" || q.fees.length > 0`. In the result area, where `analysis.analysis.totalGap` is shown (find it with `grep -n "totalGap" components/QuoteCheck.tsx`), add next to it:
```tsx
                {analysis.analysis.feesLump !== null ? (
                  <Typography variant="paragraph-sm">
                    Taxes, fees and adjustments: {fmtUsd(analysis.analysis.feesLump)} (the out-the-door total minus the price).
                  </Typography>
                ) : null}
```
Where `retentionSource === "model"` is shown (around line 589), add the used-car basis line:
```tsx
                {analysis.analysis.resaleBasis === "used-age-miles"
                  ? " Resale uses this model's sales by age, placed by this car's age and mileage."
                  : analysis.analysis.resaleBasis === "used-age"
                    ? " Resale uses this model's sales by age. This estimate uses the car's age, not its mileage."
                    : analysis.analysis.resaleBasis === "used-typical"
                      ? " Resale uses a typical used-car curve; we have no sales history for this model."
                      : ""}
```
Below the read-status text in the photo `<section>`, add:
```tsx
          {q.readMode === "terms" && lastFile.current && readState === "idle" ? (
            <Button type="button" variant="link" linkUnderline="static" className="min-h-11 self-start underline underline-offset-2"
              onClick={() => void onPhoto(lastFile.current ?? undefined, "full")}>
              Read everything, fees included
            </Button>
          ) : null}
```
Change the reading message to `Reading… ${elapsed} s. This usually takes a few seconds. You can keep typing meanwhile.`. If Task 2's gate failed, set the default `mode` in `onPhoto` to `"full"` instead, and leave the message as it was.

- [ ] **Step 6: Build, test and commit**

```bash
npm run build 2>&1 | grep -E "error|Compiled"; npm test 2>&1 | grep -E "Tests|FAIL"
cd ~/cv-meta-hackathon-2026 && .venv/bin/python scripts/name_guard.py && .venv/bin/python scripts/secret_guard.py --all
git add lowkey/app/components/QuoteCheck.tsx lowkey/app/lib/quote/compare.ts
git commit -m "057: the quote screen reads the terms and looks up the car by VIN

Assisted-by: agent"
```

---

### Task 10: End to end, the report and the PR

**Files:**
- Create: `ops/reports/057-lowkey-vin-first-quote.md`
- Modify: `ops/tasks/057-lowkey-vin-first-quote.md` (`status: done`)

- [ ] **Step 1: Local end to end with mocks**

Start the server on port 3057: `cd lowkey/app && (set -a; . ~/.config/low-key/env; set +a; LOWKEY_TABLE_FILE=~/.cache/low-key/table.json nohup npx next start -p 3057 > $SCRATCH/srv057.log 2>&1 &)`. Write a headless Chrome CDP script, modelled on the scratchpad `start.mjs` from task 056, that:
1. Opens `/quote` at 390×844, then intercepts `/api/quote/read`, `/api/quote/result/*` and `/api/vin*` with `Fetch.enable` and `Fetch.fulfillRequest`. The mocked responses are: read → `{"id":"fc-test1234"}` (202); result → `{"status":"done","read":{"doc_type":"terms","mode":"terms","vin":"1HGCV2FA9SB601815","vin_check_ok":true,"selling_price":28450,"down":3000,"apr":6.9,"term_months":72,"stated_monthly":512.33,"out_the_door":31204.1,"mileage":18420,"fees":[],"payment_options":[]}}`; vin → the fixture mapped through `mapVinResponse`, plus `retention` with the fixture model's points.
2. Uploads a generated Code 39 VIN PNG (from `zxing-wasm/full` `writeBarcode`) through the file input with `DOM.setFileInputFiles`.
3. Asserts: the car header text, "· 18,420 mi", the "Taxes, fees and adjustments: $2,754.10" line, no "Fees and add-ons" section, and the used-basis sentence.
4. Repeats in dark mode (`Emulation.setEmulatedMedia` `prefers-color-scheme: dark`) and takes screenshots of both.

Check the screenshots by eye. Stop the server with `fuser -k 3057/tcp`.

- [ ] **Step 2: All gates**

```bash
cd ~/cv-meta-hackathon-2026/lowkey/app && npm ci && npm run build && npm test
cd ~/cv-meta-hackathon-2026 && .venv/bin/python -m pytest -q && .venv/bin/python scripts/name_guard.py && .venv/bin/python scripts/secret_guard.py --all
```
Expected: everything passes. Record the counts.

- [ ] **Step 3: Write the report and close the task**

`ops/reports/057-lowkey-vin-first-quote.md` has a status line, Summary, Work done (per task with commit hashes), Checked (the eval tables for both modes with medians, the real-document pass/fail per field without values, the VIN probe's cost, the mileage fit's result and spend, the gates' counts, and the screenshots), and Open (anything deferred, for example a barcode decode not verified under vitest). Set `status: done` in the task file.

- [ ] **Step 4: Push and open the PR**

```bash
git add ops/reports/057-lowkey-vin-first-quote.md ops/tasks/057-lowkey-vin-first-quote.md
git commit -m "Finish task 057: the VIN-first quote check

Assisted-by: agent"
git push -u origin task/057-vin-first-quote
gh pr create --base main --head task/057-vin-first-quote --title "057: VIN-first quote check" --body "<summary from the report; end with: Assisted-by: agent>"
```

- [ ] **Step 5: Verify the preview**

Get the preview URL with `vercel ls low-key --scope meta-cv-hackathon` (it prints its table to stderr) and check it with `vercel inspect <url>`. Verify it server-side: `vercel curl --deployment <url> --scope meta-cv-hackathon -- -s "/api/vin?vin=<the probe VIN>"` returns `ok: true`. Do one real read through the preview's `/api/quote/read` with `mode: "terms"` on a fixture image. Add the preview URL to the PR body.
