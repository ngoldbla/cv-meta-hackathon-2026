"""P10 Muse Spark tool use (task 023, part 2).

Calls muse-spark-1.3 through the OpenAI-compatible Chat Completions
endpoint with three tool definitions (rank_category, ownership_math,
local_units) backed by stubs that return fixed fixture values. Runs
10 prompts, checks automatically that the expected tools were called
and that every number in each reply appears in a tool result, and
records latency per turn and tokens used.

Spark spends hidden reasoning tokens before it answers: at
max_tokens 1600 the final round used 1598 reasoning tokens and
finished empty (finish_reason "length"), so max_tokens is 4000 here
and no reasoning-effort parameter is sent. The key comes from the
environment only (META_API_KEY) and is never printed. Results are
cached outside git.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.request
from pathlib import Path

OUT = Path.home() / ".cache" / "low-key" / "preflight" / "p10_results.json"
ENDPOINT = "https://api.meta.ai/v1/chat/completions"
MODEL = "muse-spark-1.3"
MAX_TOKENS = 4000

SYSTEM = (
    "You are Low Key, a car-buying chat. You must call tools before "
    "answering whenever a tool can supply the facts. Rules: any "
    "mention of sedans, SUVs or pickups as a type to consider is a "
    "request for the ranking, so call rank_category for that category "
    "(map plurals such as 'sedans' to 'Sedan'); call local_units when "
    "the user asks about cars in stock nearby or gives a ZIP for "
    "local availability — a ZIP never replaces the ranking when a "
    "category is named; call ownership_math when the user asks about "
    "monthly payments, down payments, walk-away costs or being "
    "underwater. Never invent or compute numbers: copy every number "
    "verbatim from tool results, including decimals. If a number is "
    "not in a tool result, do not state it. Keep each answer short."
)

# Fixed fixtures (values echo the committed task-023 lineups where a
# category is involved). Stubs ignore their inputs except to echo them.
RANK_FIXTURES = {
    "SUV": {
        "category": "SUV",
        "picks": [
            {"rank": 1, "make": "Honda", "model": "CR-V", "price": 34899,
             "retention_5y": 0.629, "dep_per_month": 216},
            {"rank": 2, "make": "Toyota", "model": "Corolla Cross", "price": 32783,
             "retention_5y": 0.623, "dep_per_month": 206},
        ],
        "commodity": {"make": "Hyundai", "model": "Venue", "dep_per_month": 176},
    },
    "Sedan": {
        "category": "Sedan",
        "picks": [
            {"rank": 1, "make": "Honda", "model": "Accord Sedan", "price": 31472,
             "retention_5y": 0.656, "dep_per_month": 180},
            {"rank": 2, "make": "Honda", "model": "Civic Sedan", "price": 28180,
             "retention_5y": 0.653, "dep_per_month": 163},
        ],
        "commodity": {"make": "Honda", "model": "Civic Sedan", "dep_per_month": 163},
    },
    "Pickup": {
        "category": "Pickup",
        "picks": [
            {"rank": 1, "make": "Toyota", "model": "Tacoma", "price": 46039,
             "retention_5y": 0.633, "dep_per_month": 281},
            {"rank": 2, "make": "Ram", "model": "1500", "price": 55801,
             "retention_5y": 0.609, "dep_per_month": 364},
        ],
        "commodity": {"make": "Ford", "model": "Maverick", "dep_per_month": 264},
    },
}

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "rank_category",
            "description": "Return the ranked picks and commodity pick for a category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": ["Sedan", "SUV", "Pickup"]}
                },
                "required": ["category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ownership_math",
            "description": (
                "Return the monthly payment, walk-away costs and underwater "
                "month for a price, down payment, APR and term."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "price": {"type": "number"},
                    "down": {"type": "number"},
                    "apr": {"type": "number"},
                    "term": {"type": "integer"},
                    "model": {"type": "string"},
                },
                "required": ["price"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "local_units",
            "description": "Return new in-stock units near a ZIP code.",
            "parameters": {
                "type": "object",
                "properties": {
                    "zip": {"type": "string"},
                    "model": {"type": "string"},
                    "category": {"type": "string"},
                    "radius": {"type": "integer"},
                },
                "required": ["zip"],
            },
        },
    },
]

CASES: list[tuple[str, set[str]]] = [
    ("60614, SUV", {"rank_category", "local_units"}),
    ("Show me sedans near 60614", {"rank_category", "local_units"}),
    ("Only pickups near 30097", {"rank_category", "local_units"}),
    ("What would a $34,899 SUV cost per month with 10% down?", {"ownership_math"}),
    ("What if I put $5k down on a $28,180 car?", {"ownership_math"}),
    ("When do I stop being underwater on a $46,039 pickup?", {"ownership_math"}),
    ("Are there any CR-Vs in stock near 30097?", {"local_units"}),
    ("SUVs near 59001", {"rank_category", "local_units"}),
    ("What is the walk-away cost after 1 year for a $31,472 sedan?", {"ownership_math"}),
    ("Pickups near 60614 — what should I buy and what is nearby?",
     {"rank_category", "local_units"}),
]


def stub(name: str, args: dict) -> dict:
    if name == "rank_category":
        fixture = RANK_FIXTURES.get(args.get("category", "SUV"), RANK_FIXTURES["SUV"])
        return {**fixture, "echo": args}
    if name == "ownership_math":
        return {
            "echo": args,
            "monthly_payment": 612,
            "walk_away_cost": {"month_6": 3100, "month_12": 5200, "month_24": 8100,
                               "month_36": 10400, "month_60": 12960},
            "underwater_month": 14,
            "term_months": 60,
        }
    if name == "local_units":
        return {
            "echo": args,
            "units_found": 3,
            "units": [
                {"dealer": "Fixture Motors North", "distance_miles": 4.2, "price": 34899},
                {"dealer": "Fixture Motors West", "distance_miles": 9.6, "price": 35250},
            ],
        }
    return {"echo": args, "error": "unknown tool"}


def chat(messages: list[dict]) -> tuple[dict, float]:
    payload = {
        "model": MODEL,
        "messages": messages,
        "tools": TOOLS,
        "tool_choice": "auto",
        "max_tokens": MAX_TOKENS,
    }
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {os.environ['META_API_KEY']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    start = time.monotonic()
    with urllib.request.urlopen(req, timeout=180) as resp:
        body = json.loads(resp.read())
    return body, time.monotonic() - start


NUMBER_RE = re.compile(r"\d[\d,]*\.?\d*")


def numbers_in(text: str) -> set[float]:
    out: set[float] = set()
    for raw in NUMBER_RE.findall(text):
        try:
            out.add(float(raw.replace(",", "")))
        except ValueError:
            continue
    return out


def run_case(index: int, prompt: str, expected: set[str]) -> dict:
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": prompt},
    ]
    called: list[str] = []
    tool_payloads: list[str] = []
    usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
             "reasoning_tokens": 0}
    latencies: list[float] = []
    reply = ""
    for _round in range(4):
        body, elapsed = chat(messages)
        latencies.append(elapsed)
        raw_usage = body.get("usage") or {}
        for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
            usage[key] += int(raw_usage.get(key) or 0)
        usage["reasoning_tokens"] += int(
            (raw_usage.get("completion_tokens_details") or {}).get("reasoning_tokens") or 0
        )
        message = body["choices"][0]["message"]
        tool_calls = message.get("tool_calls") or []
        if not tool_calls:
            reply = message.get("content") or ""
            break
        messages.append(message)
        for call in tool_calls:
            fn = call["function"]
            called.append(fn["name"])
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            result = stub(fn["name"], args)
            payload = json.dumps(result)
            tool_payloads.append(payload)
            messages.append(
                {"role": "tool", "tool_call_id": call["id"], "content": payload}
            )
    allowed_numbers = numbers_in(" ".join(tool_payloads))
    reply_numbers = numbers_in(reply)
    invented = sorted(reply_numbers - allowed_numbers)
    tools_ok = expected.issubset(set(called))
    return {
        "case": index,
        "prompt": prompt,
        "expected_tools": sorted(expected),
        "called_tools": called,
        "tools_ok": tools_ok,
        "reply": reply,
        "empty_reply": not reply.strip(),
        "invented_numbers": invented,
        "numbers_ok": not invented and bool(reply.strip()),
        "latency_s": round(sum(latencies), 2),
        "round_latencies_s": [round(x, 2) for x in latencies],
        "usage": usage,
    }


def main() -> None:
    results = [run_case(i + 1, p, e) for i, (p, e) in enumerate(CASES)]
    total_usage = {
        k: sum(r["usage"][k] for r in results)
        for k in ("prompt_tokens", "completion_tokens", "total_tokens", "reasoning_tokens")
    }
    tools_pass = sum(1 for r in results if r["tools_ok"])
    numbers_pass = sum(1 for r in results if r["numbers_ok"])
    for r in results:
        print(
            f"case {r['case']}: tools={'OK' if r['tools_ok'] else 'MISS'} "
            f"called={r['called_tools']} numbers={'OK' if r['numbers_ok'] else 'INVENTED ' + str(r['invented_numbers'])} "
            f"latency={r['latency_s']}s tokens={r['usage']['total_tokens']}",
            flush=True,
        )
    summary = {
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "cases": results,
        "totals": {
            "usage": total_usage,
            "tools_pass": f"{tools_pass}/10",
            "numbers_pass": f"{numbers_pass}/10",
            "pass": tools_pass == 10 and numbers_pass == 10,
        },
    }
    OUT.write_text(json.dumps(summary, indent=1))
    print(json.dumps(summary["totals"], indent=1))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
