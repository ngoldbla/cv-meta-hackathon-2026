"""``cages`` command line: thin wrappers over the library and the loop tools."""

from __future__ import annotations

import argparse
import json
import sys


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="cages")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("simulate", help="run one venue evacuation on the 7 line")
    s.add_argument("--controller", default="rolling_horizon")
    s.add_argument("--occupancy", type=int, default=40000)
    s.add_argument("--subway-share", type=float, default=0.45)
    s.add_argument("--hour", type=int, default=21)
    s.add_argument("--failures", default="0,0,0,0,0", help="w1,w2,w4,w6,w9 severities in [0,1]")
    s.add_argument("--seed", type=int, default=0)
    e = sub.add_parser("eval-dev", help="closed-loop evaluation on the dev split")
    e.add_argument("controllers", nargs="+")
    e.add_argument("--n", type=int, default=20)
    sub.add_parser("mcp", help="start the MCP server (stdio)")
    a = ap.parse_args(argv)
    if a.cmd == "simulate":
        from .data.stock import load_line_stock
        from .harness.evaluate import make_controller
        from .sim import FailureModes, Simulation, evacuation_scenario, evaluate

        fm = FailureModes(*[float(x) for x in a.failures.split(",")])
        sc = evacuation_scenario(load_line_stock(), occupancy=a.occupancy, subway_share=a.subway_share, hour=a.hour,
                                 failures=fm, seed=a.seed)
        sim = Simulation(sc, make_controller(a.controller)).run()
        print(json.dumps(evaluate(sim), indent=1))
    elif a.cmd == "eval-dev":
        from .harness.evaluate import eval_dev

        print(json.dumps(eval_dev(a.controllers, a.n)["summary"], indent=1))
    elif a.cmd == "mcp":
        from .harness.mcp_server import mcp

        mcp.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
