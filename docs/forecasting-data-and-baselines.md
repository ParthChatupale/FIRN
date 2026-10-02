# Forecasting data and baseline decision

**Status:** Phase 3 foundation; no external weather feed is connected.  
**Updated:** 2026-10-02

## Data-source decision

ERA5 from the Copernicus Climate Change Service (C3S), produced by ECMWF, is the preferred *candidate historical hindcast reference* for an eventual site-specific weather evaluation. This is a documented candidate, not an approved site/data integration. Its recorded characteristics are:

| Property | Record |
|---|---|
| Dataset | ERA5 hourly data on single levels from 1940 to present |
| Provider | Copernicus Climate Change Service (C3S), implemented by ECMWF |
| Data type | Global atmospheric reanalysis (retrospective, model-based best estimate informed by assimilated observations) |
| Coverage and time step | Global; hourly; dataset extends from 1940 onward and is updated over time |
| Atmospheric grid | Regular latitude/longitude, 0.25° × 0.25° regridded product; point requests resolve to a grid point |
| Candidate fields | 2 m air temperature, 10 m wind components, total cloud cover, precipitation, and surface solar radiation, subject to checking the selected catalogue entry and units when integrating |
| Licence/attribution | Copernicus licence / CC BY terms presented by the dataset; visible Copernicus attribution is required. Recheck current terms and dataset citation at integration time. |
| FIRN usage status | No request made, no data downloaded, no external coordinates selected, and no ERA5 records stored in this repository |

ERA5 is not station-scale: the grid footprint is much larger than local station conditions. Reanalysis is a retrospective estimate, not an operational forecast or direct station observation. It must not be described as a live forecast or as Alpha telemetry. See the [ERA5 dataset entry](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview) and [hourly time-series guide](https://confluence.ecmwf.int/pages/viewpage.action?pageId=639213149).

The dataset is provided under the Copernicus licence, which requires clear, visible attribution. For publicly communicated adapted data, include the required attribution and disclaimer. Proposed display text when actually using such data: “Generated using Copernicus Climate Change Service information [YEAR]. Neither the European Commission nor ECMWF is responsible for any use that may be made of the Copernicus information or data it contains.” Confirm the current licence and citation before integration: [Licence to use Copernicus Products](https://cds.climate.copernicus.eu/licences/licence-to-use-copernicus-products).

### Current boundary

- `Polar Station Alpha` remains fictional and has no latitude/longitude. Do not request or imply an ERA5 location until the project explicitly selects a representative real site or reference point.
- Existing simulator weather and station demand are synthetic. This phase uses generated telemetry only to exercise forecast code and verify deterministic evaluation mechanics; resulting scores are not evidence of real-world forecast skill.
- Station demand is not supplied by ERA5. It needs station observations for a real-data forecast evaluation; until available, demand baselines are evaluated against held-out synthetic simulator trajectories and labeled accordingly.
- No data has been downloaded or added to the repository. No credentials or external service are required for the current baseline.

## Resolution, timestamps, and gaps

The simulator emits hourly telemetry. The baseline contract therefore expects a gap-free hourly sequence; timestamps must be parsed with their explicit UTC offset and normalized to UTC before alignment. A real-data ingestion adapter must retain source, variable, units, original timestamp, retrieval/version metadata, and missing-value markers.

Do not silently forward-fill long gaps or score across missing observations. For initial hindcasts, split into contiguous hourly segments, discard any forecast window whose training or scoring interval contains a missing target, and report discarded/usable counts. Convert variables to consistent units before scoring. Any aggregation, interpolation, or grid-to-site mapping must be explicit and recorded; do not imply that interpolation creates station-scale truth.

## Baselines implemented

`backend/simulation/forecasting.py` provides two deterministic reference methods for numeric hourly series. The evaluator is a pure Python calculation: it does not fit parameters or make network/database calls.

1. **Persistence:** carry the last available value forward for every lead hour: `forecast(t+h) = observed(t)`.
2. **Daily seasonal-naive:** repeat the latest complete 24-hour sequence, cycling it for longer horizons: `forecast(t+h) = observed(t - 24 + ((h - 1) mod 24) + 1)`. The period is configurable; this is a simple daily-cycle baseline, not a climatological model.

The rolling-origin evaluator takes an ordered numeric series and, at each origin, passes only the prefix ending before that origin to the forecaster. It predicts the immediately following horizon and scores those predictions. It reports the number of forecast origins/values, MAE, RMSE, signed mean error (forecast minus actual), and the same metrics by lead hour. Metric definitions are `MAE = mean(abs(forecast - actual))`, `RMSE = sqrt(mean((forecast - actual)^2))`, and `mean_error = mean(forecast - actual)`.

The caller must supply a contiguous, gap-free hourly series in chronological order. The current function validates finite numeric values but does not validate timestamps, units, gaps, or source provenance; those checks belong to a future ingestion/evaluation adapter. No model is fitted on the held-out portion, and the implementation has no uncertainty/probability output.

These baselines are intended for the first comparisons of temperature, wind, visibility, renewable generation, and demand where the target exists. They do not yet forecast weather regimes jointly, model uncertainty, or feed forecasts into the simulator. Do not interpret an uncalibrated range or simulator randomness as a probability forecast.

### Reproducible synthetic holdout smoke evaluation

For an implementation check, a 30-day `normal` simulation with seed `42` was split into the first 23 days for training and the final 7 days (168 hours) for one held-out forecast origin. The table shows MAE for that **single synthetic trajectory**; units follow the corresponding telemetry field. It is useful for confirming the evaluator and contrasting simple baselines, not as evidence of real forecast quality.

Reproduce the run and 168-hour holdout with this snippet from the repository root. Each metric uses telemetry from the current synthetic engine; this does not access ERA5.

```python
from backend.simulation.engine import SimulationEngine
from backend.simulation.scenarios import build_scenario
from backend.simulation.forecasting import evaluate_rolling_origin

rows = SimulationEngine().run(
    build_scenario("normal", days=30, seed=42)
).telemetry
targets = ["temperature_c", "wind_kmh", "visibility_km", "solar_kw", "renewable_kw", "demand_kw"]
for target in targets:
    values = [row[target] for row in rows]
    scores = {
        method: evaluate_rolling_origin(
            values,
            horizon_hours=168,
            method=method,
            min_training_hours=552,
        )["mae"]
        for method in ("persistence", "seasonal_naive")
    }
    print(target, scores)
```

There is exactly one forecast origin: the first 552 hourly values (23 days) form the training prefix; all 168 subsequent values (the final 7 days) are held out. The current simulator's default start time is `2032-01-01T00:00:00+00:00`. Rounded results are below; exact values are determined by the simulator code/version and seed.

| Target | Unit | Persistence MAE | Daily seasonal-naive MAE |
|---|---:|---:|---:|
| Temperature | °C | 1.423 | 1.775 |
| Wind speed | km/h | 8.221 | 9.416 |
| Visibility | km | 1.213 | 1.405 |
| Solar output | kW | 6.064 | 3.202 |
| Renewable output | kW | 9.680 | 7.872 |
| Station demand | kW | 0.783 | 0.976 |

The results vary by target, which is why a named baseline must not be assumed to win across all variables. More independent seeds and a geographically selected, versioned hindcast are required before drawing useful conclusions.

## Synthetic trajectories propagated through the simulator

`backend/simulation/forecast_scenarios.py` builds four explicit hourly weather-forcing profiles and passes them into the existing `SimulationEngine`. Every weather point specifies regime, temperature, wind speed, visibility, and solar/wind availability factors. The first three profiles repeat a four-block daily cycle, with each block lasting six hours. These hand-authored values are illustrative engineering assumptions, not Antarctic climate statistics.

| Trajectory | Profile definition |
|---|---|
| Favorable | Repeating clear / clear / cloudy / clear blocks; temperatures −20 to −22 °C, winds 39–47 km/h, visibility 6–8 km, solar factors 0.68–0.96, wind factors 0.82–0.94. |
| Nominal | Repeating clear / cloudy / cloudy / clear blocks; temperatures −23 to −25 °C, winds 31–37 km/h, visibility 4–5.5 km, solar factors 0.38–0.78, wind factors 0.62–0.74. |
| Low renewable | Repeating cloudy blocks; temperatures −28 to −30 °C, winds 17–23 km/h, visibility 2.8–3.4 km, solar factors 0.12–0.20, wind factors 0.30–0.40. |
| Storm | Nominal background with a fixed 36-hour storm interval starting at `min(24, max(0, hours // 4))`; storm forcing is −31 °C, 100 km/h wind, 0.7 km visibility, solar factor 0.08, and wind factor 0.0. The 100 km/h wind is above the current model's turbine cut-out threshold. |

The engine accepts an optional validated weather-forcing series of exactly one item per simulation hour. Without that argument it follows the existing seeded stochastic-weather path unchanged. The four-way comparison helper uses the same normal station configuration, mission schedule, initial state, duration, and seed for every run. It disables resupply in all four matched runs so an artificial resupply moved to the final hour by short-run scenario setup does not distort end-of-run fuel inventory. Results include renewable and generator energy, fuel use and remaining inventory, unserved energy, critical-load violations, battery minimum, and per-mission outcomes.

### One matched comparison (7 days, seed 42)

All values below are from the synthetic model and are not empirical station performance. Fuel starts at 3,000 L, with resupply disabled consistently for this comparison.

| Trajectory | Renewable energy (kWh) | Generator energy (kWh) | Fuel used (L) | Fuel remaining (L) | Missions completed / deferred | Unserved energy (kWh) | Critical-violation hours |
|---|---:|---:|---:|---:|---:|---:|---:|
| Favorable | 8,595.419 | 2,780.097 | 796.427 | 2,203.573 | 4 / 0 | 0 | 0 |
| Nominal | 4,990.810 | 6,027.890 | 1,705.809 | 1,294.191 | 4 / 0 | 0 | 0 |
| Low renewable | 1,625.217 | 9,809.283 | 2,764.599 | 235.401 | 4 / 0 | 0 | 0 |
| Storm | 3,948.601 | 7,184.099 | 2,011.548 | 988.452 | 3 / 1 | 0 | 0 |

In this run, the storm defers the scheduled field survey because visibility is below its mission minimum. The low-renewable trajectory leaves only 235.401 L after seven days, although this particular run has no unserved energy or critical-load violation. Battery minimum remains 270 kWh in all four cases: the current simulator dispatches generators before using the battery, so this comparison does not demonstrate battery cycling. These are useful scenario consequences to inspect, not proof of forecast accuracy or an optimizer recommendation.

Reproduce the comparison from the repository root:

```python
from dataclasses import asdict
from backend.simulation.forecast_scenarios import compare_synthetic_trajectories

for result in compare_synthetic_trajectories(days=7, seed=42):
    print(asdict(result))
```

Each result carries the explicit classification `synthetic scenario; not a forecast or calibrated probability`. The weather profiles are deterministic scenario assumptions; no P10/P50/P90 interpretation is supported.

## Multi-seed synthetic baseline evaluation

`backend/simulation/forecast_evaluation.py` runs the normal synthetic simulator independently for seeds `0` through `19`. For each seed, it trains on the first 552 hours (23 days) and evaluates one 168-hour holdout (the final seven days). It repeats this for the six telemetry targets and both point baselines. The report retains each seed-level score and summarizes the seed-to-seed mean, median, minimum, and maximum of MAE, RMSE, and signed mean error.

The following MAE table reports the **mean across 20 seed-level holdout MAEs**, with the observed minimum-to-maximum seed-level MAE in brackets. Units follow each target. This spread describes sensitivity to the simulator's seed only; it is not a forecast prediction interval, weather uncertainty estimate, confidence interval, or calibration result.

| Target | Unit | Persistence mean MAE [min–max] | Daily seasonal-naive mean MAE [min–max] |
|---|---:|---:|---:|
| Temperature | °C | 2.440 [1.313–5.256] | 2.685 [1.804–5.707] |
| Wind speed | km/h | 14.803 [5.678–47.261] | 17.986 [6.578–48.999] |
| Visibility | km | 1.518 [0.969–2.794] | 1.756 [1.329–2.653] |
| Solar output | kW | 6.677 [4.149–9.012] | 3.998 [2.223–7.834] |
| Renewable output | kW | 13.304 [9.664–23.970] | 11.611 [6.209–24.169] |
| Station demand | kW | 1.342 [0.722–2.893] | 1.477 [0.992–3.138] |

Reproduce the complete raw and aggregate report from the repository root:

```python
from backend.simulation.forecast_evaluation import evaluate_synthetic_seed_set

report = evaluate_synthetic_seed_set(
    tuple(range(20)), days=30, horizon_hours=168
)
for row in report["aggregate"]:
    mae = row["metrics_across_seeds"]["mae"]
    print(row["target"], row["method"], mae)
```

Although this is a stronger software check than a single seed, all targets still come from FIRN's synthetic generator. It cannot demonstrate real-world skill. In particular, no demand observations or observed weather have been evaluated.

## Next Phase 3 work

1. Decide the reference geography and whether ERA5 is sufficiently representative; otherwise identify a more suitable source and document terms before use.
2. Add a data adapter with explicit variable/unit mapping, UTC normalization, source provenance, and missing-data accounting.
3. Repeat held-out evaluation using an approved external hindcast plus observed station-demand data if available.
4. Add uncertainty only after point baselines and errors are established; evaluate interval calibration rather than labeling arbitrary scenario bands P10/P50/P90.
5. Surface reproducible trajectory comparisons through the API/UI after deciding which outputs and provenance operators should see.
