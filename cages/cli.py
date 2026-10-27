"""``cages`` command line: thin wrappers over the library and the loop tools."""

from __future__ import annotations

import argparse
import json
import sys


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="cages")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("simulate", help="run one surge scenario")
    s.add_argument("--controller", default="esa")
    s.add_argument("--kind", default="egress", choices=["egress", "ingress"])
    s.add_argument("--attendees", type=int, default=1200)
    s.add_argument("--failures", default="0,0,0,0,0", help="w1,w2,w4,w6,w9 severities in [0,1]")
    s.add_argument("--seed", type=int, default=0)
    e = sub.add_parser("eval-dev", help="closed-loop evaluation on the dev split")
    e.add_argument("controllers", nargs="+")
    e.add_argument("--n", type=int, default=20)
    sub.add_parser("mcp", help="start the MCP server (stdio)")
    a = ap.parse_args(argv)
    if a.cmd == "simulate":
        from .harness.evaluate import make_controller
        from .sim import FailureModes, Simulation, evaluate, venue_scenario

        fm = FailureModes(*[float(x) for x in a.failures.split(",")])
        sim = Simulation(venue_scenario(a.kind, a.attendees, fm, seed=a.seed), make_controller(a.controller)).run()
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
