"""MCP server: the experiment as tools, so any agent harness can run the loop.

    python -m cages.harness.mcp_server        # stdio transport

Tools never bypass the guardrails: holdout evaluation needs CAGES_HOLDOUT_SALT in the server's
environment and a ledger pre-registration, and runs once per pre-registration.
"""

from __future__ import annotations

try:  # MCP Python SDK 2.x
    from mcp.server.mcpserver import MCPServer as _Server
except ImportError:  # 1.x
    from mcp.server.fastmcp import FastMCP as _Server

from ..data.instances import build_scenario
from ..sim import FailureModes, Simulation, evaluate, venue_scenario
from .evaluate import eval_dev as _eval_dev
from .evaluate import eval_holdout as _eval_holdout
from .evaluate import make_controller
from .ledger import Ledger

mcp = _Server("cages")


@mcp.tool()
def simulate(controller: str = "esa", kind: str = "egress", attendees: int = 1200,
             failures: list[float] | None = None, seed: int = 0) -> dict:
    """Run one venue-tower surge with a named controller; returns ground-truth and logger metrics.
    failures = [w1_hidden_queue, w2_strand, w4_doors, w6_cold, w9_lobby], each in [0, 1]."""
    fm = FailureModes(*(failures or [0.0] * 5))
    sim = Simulation(venue_scenario(kind, attendees, fm, seed=seed), make_controller(controller)).run()
    return evaluate(sim)


@mcp.tool()
def generate_cages(out: str = "datasets/cages-dev-run", train: int = 4, dev: int = 2, workers: int = 2,
                   K: int = 4, horizon: float = 240.0, max_states: int = 10) -> dict:
    """Generate a CAGES release (specs + counterfactual-labelled decision shards)."""
    from ..data.generate import generate
    from ..data.labeler import LabelConfig

    return generate(out, train, dev, workers, LabelConfig(K=K, horizon=horizon, max_states=max_states))


@mcp.tool()
def label(spec: dict, K: int = 4, horizon: float = 240.0, max_states: int = 5) -> dict:
    """Counterfactual-label one instance spec; returns per-state best car and relative action gaps."""
    from ..data.labeler import LabelConfig, label_instance

    recs = label_instance(spec, LabelConfig(K=K, horizon=horizon, max_states=max_states, p_label=1.0))
    return {"states": [{"t": r["t"], "call": list(r["call"]), "best": r["best"], "esa": r["esa_choice"],
                        "q_rel": [float(x) for x in r["q_mean"] / r["q_mean"].min()]} for r in recs]}


@mcp.tool()
def train(data: str = "datasets/cages-v0-mini", out: str = "runs/decision-scratch", backbone: str = "scratch",
          epochs: int = 10, d_model: int = 128, n_layers: int = 4) -> dict:
    """Train the decision model (backbone: 'scratch' or 'hf:<decapitated trunk path>')."""
    from ..model.train import train as _train

    return _train(data, out, backbone, epochs, d_model=d_model, n_layers=n_layers)


@mcp.tool()
def eval_dev(controllers: list[str], n: int = 10, workers: int = 4) -> dict:
    """Closed-loop evaluation on the public dev split; returns per-controller summaries."""
    return _eval_dev(controllers, n, workers)["summary"]


@mcp.tool()
def eval_holdout(controllers: list[str], prereg_id: str, comparisons: list[list[str]], n: int = 40,
                 workers: int = 4) -> dict:
    """One-shot confirmatory evaluation on the salted holdout for a pre-registered hypothesis."""
    return _eval_holdout(controllers, prereg_id, [tuple(c) for c in comparisons], n, workers)


@mcp.tool()
def ledger_commit(kind: str, prereg_path: str | None = None, payload: dict | None = None) -> dict:
    """Append to the hash-chained ledger. kind='prereg' requires prereg_path; other kinds take a payload."""
    led = Ledger()
    if kind == "prereg":
        return led.preregister(prereg_path)
    if kind == "holdout_eval":
        raise PermissionError("holdout_eval entries are written only by eval_holdout")
    return led.append(kind, payload or {})


def spec_scenario(spec: dict):  # helper for clients that pass raw specs
    return build_scenario(spec)


if __name__ == "__main__":
    mcp.run()
