# FIRN

## Polar station operational intelligence

FIRN is an interactive operating workspace for **Polar Station Alpha**. It brings the station's missions, energy position, weather risk, asset availability, and fuel reserve into one place so an operator can understand the current situation and decide what should happen next.

When FIRN is opened, the operator can move through a connected station workflow rather than a collection of disconnected dashboards:

1. Inspect the current station state.
2. Review missions and operating constraints.
3. Explore energy, asset, weather, and fuel conditions.
4. Select a disruption and see how the operating plan changes.
5. Read the reasoning behind the recommendation.
6. Compare the operating position before and after the change.

## Operating model

<p align="center">
  <img src="docs/diagrams/image.png" alt="FIRN operating model: station inputs flow through the decision layer into operator-approved execution and significant-change replanning" width="100%" />
</p>

_Figure 1. FIRN connects station inputs, decision support, operator approval, execution monitoring, and adaptive replanning._

The operator remains in control. FIRN recommends, explains, and adapts; it does not silently activate a plan or control physical station equipment.

## The FIRN workspace

### Station Overview

The landing screen presents the current operating picture:

- renewable generation and station demand;
- battery state and reserve position;
- fuel reserve and estimated runway;
- mission status and schedule health;
- temperature, wind, visibility, and weather risk;
- the current FIRN operating recommendation.

The overview is designed to answer: **What is happening at the station, and does the operator need to act?**

### Mission Planner

The Mission Planner presents the station's scientific and operational mission queue. Each mission carries a priority, power requirement, duration, deadline, weather dependency, equipment requirement, interruptibility, and recommendation.

The planner can generate a simulated operating schedule that places missions around renewable availability, critical loads, asset constraints, and mission priority.

### Energy & Assets

The Energy & Assets workspace shows the infrastructure FIRN is planning around:

- solar generation;
- wind generation;
- battery capacity and state of charge;
- backup generators;
- asset health and availability;
- maintenance and operating constraints.

This makes it clear which assets are available to the operating plan and which are constrained or unavailable.

### Forecast & Risk

The Forecast workspace shows the next operating window for:

- renewable generation;
- station demand;
- battery state of charge;
- forecast confidence;
- upcoming weather-driven risk.

The forecast view makes the relationship between future conditions and mission timing visible.

### Scenario Simulator

The Scenario Simulator is the main interaction surface for changing station conditions. It provides selectable operating scenarios:

- Normal Conditions;
- Severe Storm;
- Generator Failure;
- Fuel Resupply Delay;
- Low Battery Capacity.

Each scenario can be executed through the FastAPI simulation service. The interface displays the persisted run summary and hourly telemetry returned from PostgreSQL. The separate reference panels are illustrative; the current simulator executes a supplied schedule and baseline dispatch rather than optimizing or replanning missions.

### Decision Log

The Decision Log presents the chain behind an operating recommendation:

```text
Observation → Forecast → Risk assessment → Operating decision → Explanation
```

It gives the operator a readable history of why a simulated action was taken and which station conditions influenced it.

## Current operating environment

The screens currently use synthetic scenario state local to the browser. Alongside that interface, FIRN now includes a deterministic Python station simulation engine that runs hourly scenarios from explicit station, resource, weather, mission, and event inputs.

Neither the interface nor the simulation engine is connected to live station telemetry, real sensors, or external weather services. The engine is a reproducible operating model; it executes a supplied mission schedule and baseline dispatch policy. The Scenario Simulator is connected to a FastAPI/PostgreSQL persistence slice; its Phase 2 `simulation_runs` / `simulation_telemetry` migration is applied to the local `firn_db`. This is not the final FIRN operational database schema.

The application is intentionally focused on making the operating workflow clear and believable. The planning experience can become more detailed over time without changing the operator-facing workspace.

## Run FIRN locally

### Requirements

- Node.js 20 or newer
- npm
- Python 3.11 or newer

### Start the workspace

Configure Python dependencies and local PostgreSQL credentials by following [docs/backend-setup.md](docs/backend-setup.md). Because PostgreSQL is installed in WSL on this workstation, start the backend in a WSL terminal—not Windows PowerShell:

```sh
cd /mnt/c/FIRN/firn-polar-ops
source .venv-wsl/bin/activate
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Then start the frontend in another terminal:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

The Python API and PostgreSQL setup instructions are in [docs/backend-setup.md](docs/backend-setup.md).

### Build and preview

```sh
npm run build
npm run preview
```

## Current experience

FIRN currently provides a connected station workspace with:

- a shared station shell and navigation;
- cross-screen scenario state;
- mission, energy, asset, forecast, and decision views;
- simulated recommendations and adaptive responses;
- explainable decision dialogs;
- responsive layouts for presentation and laptop use;
- clear separation between station simulation and live infrastructure.

The central experience is the transition from a stable operating plan to a changed condition, followed by FIRN's recommendation and the operator's review of what changed.

## Run the station simulation

The Python engine uses only the standard library and requires Python 3.11 or newer. From the repository root in WSL:

```sh
python3 -m backend.simulation.cli --scenario normal --days 30 --seed 42
```

Available scenarios are `normal`, `storm`, `generator_failure`, `resupply_delay`, and `mission_energy`. Write the complete hourly telemetry and event history to a JSON file with `--output`:

```sh
python3 -m backend.simulation.cli --scenario storm --days 30 --seed 42 --output output/storm-run.json
```

Run the simulation acceptance suite with:

```sh
python3 -m unittest discover -v
```

The engine records every hourly energy balance, load shed, critical-load violation, mission outcome, generator state, battery state, fuel movement, and scheduled event. Weather is generated from persistent, seeded regimes, so identical inputs produce identical output.

Each step is one hour. The baseline dispatch serves renewable generation first, starts available generators for a deficit, draws from the battery above its protected reserve, and serves critical and essential station loads before missions and flexible demand. Excess generation charges the battery before curtailment. Any remaining shortfall is recorded explicitly. Missions are checked against weather, equipment, personnel, and non-electric fuel constraints; the engine does not move their scheduled times.
