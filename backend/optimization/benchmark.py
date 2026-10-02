"""Repeatable apples-to-apples microbenchmark for MILP-capable solvers."""

from __future__ import annotations

import json
import subprocess
import sys
from typing import Any


def _case_data(count: int, seed: int) -> dict[str, Any]:
    if count < 2:
        raise ValueError("Benchmark sizes must be at least two missions")
    horizon = max(24, count * 4)
    durations = [2 + ((i * 7 + seed) % 3) for i in range(count)]
    weights = [1 + ((i * 11 + seed) % 4) for i in range(count)]
    starts = {
        str(i): list(range((i * 3) % 5, horizon - durations[i] + 1, 1))
        for i in range(count)
    }
    pairs = [[i, hour] for i in range(count) for hour in starts[str(i)]]
    return {
        "count": count,
        "seed": seed,
        "horizon": horizon,
        "durations": durations,
        "weights": weights,
        "starts": starts,
        "pairs": pairs,
    }


def _run_solver(solver: str, case: dict[str, Any]) -> dict[str, Any]:
    result = subprocess.run(
        [sys.executable, "-B", "-m", "backend.optimization.benchmark_worker", solver],
        input=json.dumps(case),
        capture_output=True,
        check=False,
        text=True,
    )
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(f"{solver} benchmark worker failed: {detail}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{solver} benchmark worker returned invalid output") from exc


def benchmark_solver_candidates(sizes: tuple[int, ...] = (4, 8, 12), seed: int = 17) -> dict[str, Any]:
    """Compare HiGHS and OR-Tools CP-SAT on identical integer scheduling MILPs.

    This benchmark intentionally isolates binary mission-start selection and
    hourly shared-resource occupancy. It does not benchmark the planner's
    continuous kW/kWh/fuel dispatch model.
    """
    cases = []
    for count in sizes:
        data = _case_data(count, seed)
        high = _run_solver("highs", data)
        cp = _run_solver("cp_sat", data)
        cases.append({
            "missions": count,
            "candidate_starts": len(data["pairs"]),
            "highs": high,
            "ortools_cp_sat": cp,
            "objectives_match": high["objective"] == cp["objective"],
        })
    return {
        "benchmark": "binary mission-start scheduling with at most two simultaneous missions",
        "seed": seed,
        "sizes": list(sizes),
        "cases": cases,
        "caveat": "This exact-integer scheduling microbenchmark excludes continuous energy dispatch; timings are machine- and version-specific and do not alone select a production solver.",
    }
