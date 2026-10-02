"""Command-line entry point for running named FIRN simulation scenarios."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

from .engine import SimulationEngine
from .scenarios import SCENARIO_NAMES, build_scenario


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a deterministic FIRN station simulation.")
    parser.add_argument("--scenario", choices=SCENARIO_NAMES, default="normal")
    parser.add_argument("--days", type=int, default=30, help="Simulation length (1-365 days).")
    parser.add_argument("--seed", type=int, default=42, help="Seed used for reproducible weather.")
    parser.add_argument(
        "--output", type=Path,
        help="Write complete summary, hourly telemetry, missions, and event history as JSON.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = make_parser()
    args = parser.parse_args(argv)
    try:
        config = build_scenario(args.scenario, days=args.days, seed=args.seed)
        result = SimulationEngine().run(config)
    except ValueError as exc:
        parser.error(str(exc))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(result.to_dict(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    print(json.dumps({
        "scenario": args.scenario,
        "station": result.station_name,
        "seed": result.seed,
        "summary": result.summary,
        "missions": result.mission_results,
        "events": result.event_log,
        "output": str(args.output) if args.output else None,
    }, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
