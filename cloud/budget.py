"""Hard budget caps for cloud jobs (any CUDA provider).

Every job declares its hourly price and a dollar cap; the guard refuses to start a job that could
push cumulative spend (logged in runs/spend.jsonl) over the program budget, and kills the job
when its own cap is reached.  Spend is estimated from wall-clock time x hourly price.

    python cloud/budget.py run --name glimmer-L8 --price 2.50 --cap 20 -- python -m cages.model.train ...
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

LOG = Path("runs/spend.jsonl")
PROGRAM_BUDGET_USD = 100.0


def spent() -> float:
    if not LOG.exists():
        return 0.0
    return sum(json.loads(line)["usd"] for line in LOG.read_text().splitlines() if line.strip())


def run(name: str, price_per_hour: float, cap_usd: float, cmd: list[str], budget: float = PROGRAM_BUDGET_USD) -> int:
    already = spent()
    if already + cap_usd > budget:
        print(f"refused: {name} cap ${cap_usd:.2f} + spent ${already:.2f} exceeds budget ${budget:.2f}")
        return 3
    limit_s = 3600.0 * cap_usd / price_per_hour
    t0 = time.time()
    proc = subprocess.Popen(cmd)
    try:
        code = proc.wait(timeout=limit_s)
    except subprocess.TimeoutExpired:
        proc.kill()
        code = 124
        print(f"{name}: cap reached after {limit_s / 3600:.2f} h; job killed")
    usd = (time.time() - t0) / 3600.0 * price_per_hour
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a") as f:
        f.write(json.dumps({"name": name, "usd": round(usd, 4), "price": price_per_hour, "exit": code,
                            "seconds": round(time.time() - t0, 1), "time": int(t0)}) + "\n")
    print(f"{name}: ${usd:.2f} (program total ${spent():.2f} / ${budget:.2f})")
    return code


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--name", required=True)
    r.add_argument("--price", type=float, required=True, help="USD per hour for the machine")
    r.add_argument("--cap", type=float, required=True, help="USD cap for this job")
    r.add_argument("--budget", type=float, default=PROGRAM_BUDGET_USD)
    r.add_argument("command", nargs=argparse.REMAINDER)
    sub.add_parser("status")
    a = ap.parse_args()
    if a.cmd == "status":
        print(f"spent ${spent():.2f} of ${PROGRAM_BUDGET_USD:.2f}")
        return 0
    cmd = a.command[1:] if a.command and a.command[0] == "--" else a.command
    return run(a.name, a.price, a.cap, cmd, a.budget)


if __name__ == "__main__":
    sys.exit(main())
