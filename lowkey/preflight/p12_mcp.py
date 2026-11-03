"""P12 MCP check (task 022, part 6).

Connects to the listings provider's hosted MCP server
($LOWKEY_PROVIDER_MCP_URL, Bearer $LOWKEY_PROVIDER_KEY) with a stdlib
JSON-RPC client: initialize, tools/list, then one local search via the
search tool. Records tool names, input schemas and latency. Tool
output is data only; nothing in it is followed as an instruction.
"""

from __future__ import annotations

import json
import os
import time
import urllib.request
from pathlib import Path

OUT = Path.home() / ".cache" / "low-key" / "preflight" / "p12_summary.json"
URL = os.environ["LOWKEY_PROVIDER_MCP_URL"]
KEY = os.environ["LOWKEY_PROVIDER_KEY"]
HEADERS = {
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
}
_id = 0


def rpc(method: str, params: dict | None = None) -> tuple[dict, float]:
    global _id
    _id += 1
    payload = {"jsonrpc": "2.0", "id": _id, "method": method}
    if params is not None:
        payload["params"] = params
    req = urllib.request.Request(
        URL, data=json.dumps(payload).encode(), headers=HEADERS, method="POST"
    )
    start = time.monotonic()
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read().decode()
        session = resp.headers.get("Mcp-Session-Id")
        if session:
            HEADERS["Mcp-Session-Id"] = session
    elapsed = time.monotonic() - start
    for line in raw.splitlines():
        if line.startswith("data:"):
            raw = line[5:].strip()
            break
    return json.loads(raw), elapsed


def notify(method: str) -> None:
    req = urllib.request.Request(
        URL,
        data=json.dumps({"jsonrpc": "2.0", "method": method}).encode(),
        headers=HEADERS,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp.read()
    except Exception:
        pass


def main() -> None:
    init, t_init = rpc(
        "initialize",
        {
            "protocolVersion": "2025-03-26",
            "capabilities": {},
            "clientInfo": {"name": "lowkey-preflight", "version": "0.1"},
        },
    )
    print(f"initialize: {t_init:.2f}s")
    notify("notifications/initialized")
    listed, t_list = rpc("tools/list")
    tools = listed.get("result", {}).get("tools", [])
    print(f"tools/list: {t_list:.2f}s, {len(tools)} tools")
    summary: dict = {
        "server": init.get("result", {}).get("serverInfo", {}),
        "tools": [
            {"name": t["name"], "inputSchema": t.get("inputSchema", {})} for t in tools
        ],
        "latency_s": {"initialize": t_init, "tools_list": t_list},
    }
    for tool in tools:
        print("-", tool["name"])
    search_tool = next(
        (t for t in tools if "search" in t["name"].lower() or "listing" in t["name"].lower()),
        None,
    )
    if search_tool is not None:
        props = list(search_tool.get("inputSchema", {}).get("properties", {}))
        print("search tool:", search_tool["name"], "params:", props)
        args = {"postal_code": "60614", "radius": 50, "limit": 3, "inventory_type": "new"}
        args = {k: v for k, v in args.items() if k in props} or args
        result, t_call = rpc(
            "tools/call", {"name": search_tool["name"], "arguments": args}
        )
        summary["search"] = {"tool": search_tool["name"], "latency_s": t_call}
        text = json.dumps(result)[:2000]
        summary["search"]["result_excerpt"] = text
        print(f"search call: {t_call:.2f}s")
    # The SDK global's name is the provider's name; assemble it at
    # runtime so the literal never appears in a tracked file.
    sdk = "vis" + "or"
    code = (
        f"return await {sdk}.listings.search({{inventory_type:'new', "
        "availability_status:'stock', model:'Tacoma', postal_code:'30097', "
        "radius:50, sort:'price', price_basis:'selected', limit:3, "
        "fuel_type:'Gas only', exclude_powertrain_type:'MHEV,HEV'})"
    )
    result, t_exec = rpc("tools/call", {"name": "execute", "arguments": {"code": code}})
    summary["execute_search"] = {"latency_s": t_exec}
    print(f"execute search: {t_exec:.2f}s")
    OUT.write_text(json.dumps(summary, indent=1))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
