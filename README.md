# Polar Command

Build a polished, interactive web prototype called “FIRN” — an AI-driven operational intelligence and smart energy management system for polar research stations.

IMPORTANT:

This is a DEMONSTRATION PROTOTYPE for a hackathon presentation, not a production system.

Use realistic simulated/mock data. Do NOT claim that the system is connected to real polar stations, real sensors, or real-time infrastructure.

The prototype must visually demonstrate the core concept:

Mission + Energy + Weather + Asset Health + Fuel → Joint Optimization → Adaptive Operating Plan.

==================================================

1. PRODUCT CONCEPT

==================================================

FIRN is a single operational intelligence layer for polar research stations.

The station must balance:

- Uncertain renewable energy

- Competing priorities

- Finite diesel fuel

- Changing scientific missions

- Asset availability and maintenance

- Severe and changing weather conditions

- Critical station operations

FIRN should answer three questions:

1. WHAT should the station accomplish?

2. WHEN should each mission run?

3. HOW should available energy assets be allocated?

The main differentiating concept is:

MISSION-AWARE + ASSET-AWARE + ENERGY-AWARE

                         ↓

                JOINT OPTIMIZATION

                         ↓

              ADAPTIVE OPERATING PLAN

Do not present FIRN as merely an energy dashboard.

The UI should clearly communicate that FIRN jointly plans scientific missions and energy resources.

==================================================

2. DESIGN DIRECTION

==================================================

Create a premium, modern, mission-control-style interface.

Visual style:

- Dark navy / deep blue background

- White/light text

- Cyan/ice-blue accents

- Subtle teal/blue highlights

- Glassmorphism cards, but keep them professional

- Thin borders

- Soft shadows

- Minimal gradients

- Clean data visualization

- Polar/Arctic visual identity

- Avoid overly futuristic neon/cyberpunk styling

- Avoid cartoonish visuals

The application should feel like:

“Polar Research Mission Control + Energy Management + AI Decision Support”

Use Lucide icons.

Use responsive layout, but optimize primarily for a desktop/laptop presentation screen.

Typography:

- Modern sans-serif

- Strong hierarchy

- Large dashboard numbers

- Small uppercase labels for system categories

==================================================

3. APPLICATION STRUCTURE

==================================================

Create a left sidebar navigation with:

FIRN logo/name at the top

Navigation:

- Overview

- Mission Planner

- Energy & Assets

- Forecast

- Scenario Simulator

- Decision Log

Bottom of sidebar:

- System Status: OPERATIONAL

- “Simulation Mode”

Top header:

- “Polar Station Alpha”

- Current simulated date/time

- Weather status

- System status

- Notification icon

- Operator profile/avatar

Every page should feel connected and use the same simulated station data.

==================================================

4. OVERVIEW / DASHBOARD

==================================================

Create the main dashboard as the default page.

Header:

“Station Overview”

Subtitle:

“Mission, energy and operational intelligence”

At the top, show a prominent status banner:

NORMAL OPERATING CONDITIONS

Text:

“FIRN is continuously evaluating station energy, mission requirements, asset availability and forecast conditions.”

Create 5 KPI cards:

1. Renewable Generation

Value: 68 kW

Subtitle: “Expected available”

2. Battery State

Value: 74%

Subtitle: “218 kWh usable”

3. Fuel Reserve

Value: 1,240 L

Subtitle: “12-day estimated runway”

4. Current Demand

Value: 52 kW

Subtitle: “Station load”

5. Mission Status

Value: 4 / 5

Subtitle: “Missions on plan”

Use icons and subtle status indicators.

==================================================

5. WEATHER / RISK PANEL

==================================================

Create a weather card titled:

“Environmental Conditions”

Show:

Temperature: -28°C

Wind: 42 km/h

Visibility: 4.2 km

Storm Risk: MODERATE

Show a horizontal risk indicator.

Below it:

“Forecast Alert”

“Severe storm probability increases over the next 8 hours.”

Add a small “View Forecast” button.

Do not use real weather APIs.

This is simulated data.

==================================================

6. ENERGY FLOW VISUALIZATION

==================================================

Create a visually attractive energy flow card:

“Energy Flow”

Show three energy sources flowing toward station demand:

SOLAR

22 kW

WIND

46 kW

BATTERY

12 kW

↓

STATION DEMAND

52 kW

↓

RESERVE

18 kW

Use animated but subtle flow indicators.

Below the diagram show:

Solar: Available

Wind: Available

Battery: Discharging

Generator: Standby

==================================================

7. MISSION STATUS

==================================================

Create a “Mission Operations” section.

Display mission cards/table:

MISSION | POWER | DURATION | PRIORITY | STATUS

Experiment A

8 kW

4 hrs

HIGH

RUNNING

Experiment B

10 kW

3 hrs

MEDIUM

SCHEDULED

Sample Processing

5 kW

2 hrs

HIGH

SCHEDULED

Water Production

12 kW

2 hrs

CRITICAL

PROTECTED

Atmospheric Observation

6 kW

3 hrs

MEDIUM

SCHEDULED

Use different status badges.

Make “Critical” visually distinct but not excessively bright.

==================================================

8. FIRN RECOMMENDATION PANEL

==================================================

This should be one of the most visually important components.

Create a card titled:

“FIRN Operational Recommendation”

Show:

“Current Plan: STABLE”

Then:

“FIRN recommends maintaining the current mission schedule while preserving battery reserve for the forecast weather deterioration.”

Show three mini recommendations:

MISSION

Experiment A → Continue

ENERGY

Prioritize renewable generation

RESERVE

Maintain battery reserve above 30%

Add a button:

“View Decision Reasoning”

Clicking this opens a modal explaining the decision.

==================================================

9. MISSION PLANNER PAGE

==================================================

Create a dedicated Mission Planner.

Header:

“Mission Planner”

Subtitle:

“Schedule scientific and operational activities according to energy availability, deadlines and priorities.”

Create mission cards with editable-looking controls.

Each mission should contain:

Mission name

Power requirement

Expected duration

Priority

Deadline

Weather dependency

Equipment dependency

Interruptibility

Current recommendation

Example:

Experiment A

8 kW

4 hours

High Priority

Deadline: Today, 18:00

Weather dependency: Low

Equipment: Spectrometer

Interruptible: No

Recommendation: Run during high renewable availability

Experiment B

10 kW

3 hours

Medium Priority

Deadline: Tomorrow, 18:00

Weather dependency: Medium

Equipment: Imaging System

Interruptible: Yes

Recommendation: Flexible

Sample Processing

5 kW

2 hours

High Priority

Deadline: Today, 22:00

Recommendation: Schedule during afternoon renewable peak

Water Production

12 kW

2 hours

CRITICAL

Recommendation: Protected load

Add a “Generate Optimal Plan” button.

When clicked, show a loading animation for approximately 1 second:

“Evaluating missions...”

“Checking asset availability...”

“Evaluating forecast risk...”

“Optimizing energy allocation...”

“Plan generated.”

Then display the optimized schedule.

==================================================

10. ENERGY & ASSETS PAGE

==================================================

Create a page called:

“Energy & Assets”

Show asset cards.

SOLAR ARRAY

Status: Available

Installed: 30 kW

Expected: 22 kW

Condition: 96%

WIND TURBINE

Status: Available

Installed: 50 kW

Expected: 46 kW

Condition: 91%

BATTERY

Status: Available

SOC: 74%

Usable Capacity: 218 kWh

Temperature: -25°C

DIESEL GENERATOR 01

Status: Available

Capacity: 100 kW

Fuel dependency: High

Condition: 88%

DIESEL GENERATOR 02

Status: MAINTENANCE

Capacity: 100 kW

Estimated return: 18 hours

Each asset should have:

- Status

- Capacity

- Current availability

- Health/condition

- Relevant constraint

Create an “Asset Constraint” section:

“Generator 02 unavailable due to scheduled maintenance.”

This demonstrates ASSET-AWARE planning.

==================================================

11. FORECAST PAGE

==================================================

Create a page called:

“Forecast & Risk”

Show three charts:

1. Renewable Generation Forecast

X-axis: Next 24 hours

Y-axis: kW

2. Station Demand Forecast

X-axis: Next 24 hours

Y-axis: kW

3. Battery SOC Forecast

X-axis: Next 24 hours

Y-axis: %

Use realistic simulated curves.

Below the charts show:

“Forecast Confidence”

Renewable: 82%

Demand: 91%

Weather: 76%

Then show:

“Upcoming Risk”

“Renewable generation expected to decline between 14:00–20:00 due to worsening weather conditions.”

==================================================

12. SCENARIO SIMULATOR

==================================================

THIS IS THE MOST IMPORTANT DEMO PAGE.

Create a page called:

“Scenario Simulator”

Subtitle:

“Test how FIRN adapts station operations to changing conditions.”

Create scenario buttons:

[Normal Conditions]

[Severe Storm]

[Generator Failure]

[Fuel Resupply Delay]

[Low Battery Capacity]

Default scenario:

Normal Conditions

When the user clicks “Severe Storm”, dynamically update the entire station state.

==================================================

13. SEVERE STORM SCENARIO

==================================================

When Severe Storm is selected:

Change weather:

Temperature: -31°C

Wind: 68 km/h

Visibility: 1.8 km

Storm Risk: HIGH

Change renewable generation:

Solar: 8 kW

Wind: 18 kW

Change battery:

SOC: 61%

Change system state:

“Adaptive replanning required”

Then show:

“FIRN RESPONSE”

Experiment A:

RUN → moved earlier

Experiment B:

DEFERRED

Sample Processing:

RUN

Water Production:

PROTECTED

Battery:

RESERVE PROTECTED

Generator:

READY

Fuel:

CONSERVE

Add a prominent banner:

“PLAN UPDATED”

“FIRN detected a projected renewable shortfall and automatically generated a revised operating plan.”

==================================================

14. BEFORE / AFTER COMPARISON

==================================================

On the Scenario Simulator page, create a comparison:

BEFORE STORM

Experiment A → 10:00

Experiment B → 14:00

Battery → 74%

Generator → Standby

AFTER FIRN REPLAN

Experiment A → 09:00

Experiment B → Deferred 6 hrs

Battery → Reserve protected

Generator → Ready for critical loads

Use arrows between the two states.

Add:

“Why did the plan change?”

“Expected renewable availability falls sharply during the storm window. FIRN shifts flexible missions, preserves battery reserve and keeps critical operations protected.”

==================================================

15. GENERATOR FAILURE SCENARIO

==================================================

When selected:

Generator 02:

UNAVAILABLE

Show:

“Asset failure detected.”

FIRN should respond:

- Preserve battery reserve

- Prioritize critical loads

- Shift flexible missions

- Increase renewable utilization

- Keep Generator 01 available for backup

Show:

“MISSION IMPACT”

Experiment B → Deferred

Atmospheric Observation → Rescheduled

Water Production → Protected

Heating → Protected

Communications → Protected

==================================================

16. FUEL RESUPPLY DELAY SCENARIO

==================================================

When selected:

Fuel:

1,240 L

Resupply:

Delayed by 5 days

Show warning:

“Fuel runway constraint detected.”

FIRN response:

- Reduce non-essential generator operation

- Prefer renewable energy

- Preserve fuel for critical backup

- Reschedule flexible missions

Show:

“Fuel conservation strategy activated.”

==================================================

17. LOW BATTERY CAPACITY SCENARIO

==================================================

Show:

Battery usable capacity reduced by 30%

Reason:

“Extreme cold conditions”

FIRN response:

- Increase reserve protection

- Reduce battery-dependent flexible missions

- Shift energy-intensive missions toward renewable availability

- Keep critical loads protected

==================================================

18. DECISION LOG PAGE

==================================================

Create a page called:

“Decision Log”

This page should demonstrate explainability.

Show chronological decisions:

08:00

Forecast update received

→ Storm risk increased

08:05

Renewable generation forecast reduced

→ Risk assessment updated

08:07

Battery reserve risk detected

→ Replanning triggered

08:08

Experiment B deferred

→ 6-hour delay

08:08

Battery reserve protected

→ Critical operations maintained

Each event should have timestamp, event, action and reason.

==================================================

19. DECISION REASONING MODAL

==================================================

Whenever the user clicks a recommendation, open a modal:

“Why did FIRN make this decision?”

Example:

DECISION

Defer Experiment B by 6 hours

FACTORS CONSIDERED

Weather

High storm probability

Renewable Energy

Expected generation ↓ 42%

Battery

Reserve protection required

Fuel

Finite reserve

Mission Priority

Experiment B = Medium

Critical Operations

Heating + Water + Communications = Protected

FINAL ACTION

“Defer Experiment B until renewable availability improves.”

Add a small note:

“Decision generated using simulated demonstration data.”

==================================================

20. KEY DIFFERENTIATION PANEL

==================================================

Add a compact section somewhere on the dashboard:

“Why FIRN?”

Three cards:

MISSION-AWARE

Understands what the station needs to accomplish.

ASSET-AWARE

Plans using the energy infrastructure that is actually available.

JOINT OPTIMIZATION

Schedules missions and allocates energy together.

Below:

“FIRN does not only ask how to supply energy.

It determines what the station can safely accomplish, when it should happen, and how available resources should be used.”

==================================================

21. SYSTEM STATUS

==================================================

Add a global status indicator:

● FIRN ENGINE ONLINE

Simulation Mode

At the bottom:

“Simulation environment • Demonstration data • Not connected to live station infrastructure”

This disclaimer is important.

==================================================

22. INTERACTION REQUIREMENTS

==================================================

The prototype must actually feel interactive.

Implement:

- Sidebar navigation

- Scenario switching

- Dynamic KPI updates

- Mission status updates

- Before/after comparisons

- Decision log updates

- Modal explanations

- Generate Optimal Plan button

- Forecast chart interactions/tooltips

- Hover states

- Smooth transitions

- Toast notifications when scenario changes

- Loading state when generating a plan

Do not create dead buttons.

==================================================

23. DEMO FLOW

==================================================

Optimize the application for this 45–60 second hackathon demo:

1. Start on Overview.

Say:

“FIRN continuously understands the station's energy, assets, missions and weather.”

2. Open Scenario Simulator.

Select:

“Normal Conditions”

3. Show:

Healthy energy + scheduled missions.

4. Select:

“Severe Storm”

5. Show the system updating:

Weather ↓

Renewables ↓

Battery risk ↑

6. FIRN automatically changes:

Experiment B → Deferred

Experiment A → moved earlier

Battery → Reserve protected

Critical loads → Protected

7. Open Decision Reasoning.

Show why the system made the decision.

8. Open Decision Log.

Show the adaptive decision chain.

The complete story should be:

SENSE → PREDICT → OPTIMIZE → ADAPT → EXPLAIN

==================================================

24. IMPORTANT PRODUCT LANGUAGE

==================================================

Use these exact conceptual terms throughout the UI:

Mission-Aware

Asset-Aware

Energy-Aware

Joint Optimization

Adaptive Replanning

Critical Load Protection

Fuel-Aware Planning

Weather Risk

Operational Intelligence

Explainable Decisions

Avoid generic wording like:

“Smart Energy Dashboard”

“AI Dashboard”

“Energy Monitoring System”

The prototype should clearly communicate that FIRN is an operational decision system.

==================================================

25. TECHNICAL REQUIREMENTS

==================================================

Use:

- React

- TypeScript

- Tailwind CSS

- shadcn/ui

- Recharts for charts

- Lucide icons

Use mock data stored in clean TypeScript objects.

No backend is required.

No authentication is required.

No external API is required.

No real weather API is required.

No real ML model is required.

No database is required.

The scenario engine can use predefined simulated states.

However, structure the code cleanly so that the mock scenario engine could later be replaced with a real optimization backend.

==================================================

26. FINAL QUALITY REQUIREMENT

==================================================

The application must NOT look like a generic admin dashboard.

It should look like a specialized professional control interface for a remote polar research station.

Prioritize:

- Visual hierarchy

- Large readable KPIs

- Clear decision states

- Strong scenario visualization

- Before/after comparison

- Explainability

- Mission + energy relationship

The most important screen is the Scenario Simulator because it proves FIRN's core value.

Make the prototype presentation-ready, polished, consistent and believable.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
