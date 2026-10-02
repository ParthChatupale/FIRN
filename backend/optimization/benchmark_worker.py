"""Run one solver in an isolated process for the solver microbenchmark."""

from __future__ import annotations

import json
import sys
from time import perf_counter
from typing import Any


def _solve_highs(case: dict[str, Any]) -> dict[str, Any]:
    import pyomo.environ as pyo

    count = case["count"]
    durations = case["durations"]
    weights = case["weights"]
    starts = {int(key): values for key, values in case["starts"].items()}
    pairs = [tuple(pair) for pair in case["pairs"]]
    horizon = case["horizon"]

    model = pyo.ConcreteModel()
    model.P = pyo.Set(dimen=2, initialize=pairs)
    model.x = pyo.Var(model.P, domain=pyo.Binary)
    model.constraints = pyo.ConstraintList()
    for i in range(count):
        model.constraints.add(sum(model.x[i, hour] for hour in starts[i]) <= 1)
    for hour in range(horizon):
        active = [model.x[i, start] for i, start in pairs if start <= hour < start + durations[i]]
        if active:
            model.constraints.add(sum(active) <= 2)
    model.objective = pyo.Objective(
        expr=sum(weights[i] * model.x[i, hour] for i, hour in pairs), sense=pyo.maximize
    )
    solver = pyo.SolverFactory("appsi_highs")
    if not solver.available(exception_flag=False):
        raise RuntimeError("HiGHS is unavailable; install the optimization extra")
    started = perf_counter()
    result = solver.solve(model)
    seconds = perf_counter() - started
    return {
        "status": str(result.solver.termination_condition),
        "objective": round(pyo.value(model.objective)),
        "solve_seconds": round(seconds, 6),
    }


def _solve_cp_sat(case: dict[str, Any]) -> dict[str, Any]:
    from ortools.sat.python import cp_model

    count = case["count"]
    durations = case["durations"]
    weights = case["weights"]
    starts = {int(key): values for key, values in case["starts"].items()}
    pairs = [tuple(pair) for pair in case["pairs"]]
    horizon = case["horizon"]

    model = cp_model.CpModel()
    variables = {(i, hour): model.new_bool_var(f"x_{i}_{hour}") for i, hour in pairs}
    for i in range(count):
        model.add(sum(variables[i, hour] for hour in starts[i]) <= 1)
    for hour in range(horizon):
        active = [variables[i, start] for i, start in pairs if start <= hour < start + durations[i]]
        if active:
            model.add(sum(active) <= 2)
    model.maximize(sum(weights[i] * variables[i, hour] for i, hour in pairs))
    solver = cp_model.CpSolver()
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = case["seed"]
    started = perf_counter()
    status = solver.solve(model)
    seconds = perf_counter() - started
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RuntimeError(f"CP-SAT failed: {solver.status_name(status)}")
    return {
        "status": solver.status_name(status),
        "objective": round(solver.objective_value),
        "solve_seconds": round(seconds, 6),
    }


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"highs", "cp_sat"}:
        raise SystemExit("Usage: python -m backend.optimization.benchmark_worker highs|cp_sat")
    case = json.load(sys.stdin)
    result = _solve_highs(case) if sys.argv[1] == "highs" else _solve_cp_sat(case)
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
