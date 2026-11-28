# EcoSim — Milestone 2 Baseline & Development Handoff

> **Status:** Milestone 1 (Phases 0–8) **Completed** · Milestone 2 **In Progress** (Visual Overhaul, Behavioral Physics, Organ-Based Sex & Ecological Benchmarks Completed)
> **Last Updated:** 2026-11-28

## 1. Purpose & System Nature

EcoSim is a **deterministic, modular 2D ecosystem simulator** that runs identically in a browser Web Worker (with interactive PixiJS v8 visualization and Sandbox UI) and headless in Node.js (for automated tests, benchmarks, and batch experiments).

Every living animal is composed from declarative, Zod-validated building blocks (`SpeciesBlueprint`): a procedural part-tree body (`appearance`), mounted organs/sensors/actuators (`body`), a double-buffered `Float32Array` `SignalBus` (`bus`), modular brain components (`brain`, including `@oxyrlab/neuro-learn` learners), and a motor `spine`. Every plant follows a biophysical lifecycle (`plants`) without a nervous system. All numeric caps and floors are expressed as configurable Constraint Rules (`rules`) rather than hard-coded limits.

## 2. What Is Implemented (Milestone 1 — Phases 0–8 Complete)

| Layer / Module            | Key Capabilities                                                                                                                                                                                                                                                                         | Primary Paths                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Core & Config**         | Custom ECS, seeded PRNG, `Vec2`, typed registries, error hierarchy, default rates & rule defaults                                                                                                                                                                                        | `src/core/`, `src/config/`                            |
| **Constraint Rules**      | 19 registered rules (`blueprint`, `spawn`, `runtime`) with 3-tier resolution (`default → world → species`) and lock flags                                                                                                                                                                | `src/rules/`, `docs/catalog/rules.md`                 |
| **Physics & World**       | Deterministic Rapier 2D (WASM) behind `PhysicsAdapter`, mock adapter, 8 diffused grid fields (`scent.*`, `pheromone.mate`, `soil.*`, `light`), integer-keyed `SpatialHash`                                                                                                               | `src/physics/`, `src/world/`                          |
| **Procedural Appearance** | 7 shape primitives, mirrored/chained `BodyPartSpec` tree, `resolveLayout`, convex collider decomposition, 5-D `AppearanceFeatures`, `AppearanceTextureCache`                                                                                                                             | `src/appearance/`, `src/render/species-shapes.ts`     |
| **Nervous System**        | Double-buffered `Float32Array` `SignalBus`, static wiring resolver (`fan-in`/`fan-out`, `behavior` bundles, hormones), 4 organs, 4 sensors, 3 actuators, 8 brain modules, `differential-drive` spine                                                                                     | `src/bus/`, `src/body/`, `src/brain/`, `src/spine/`   |
| **Life & Plants**         | Basal/brain/actuator metabolism, auditable `EnergyLedger`, aging/senescence, health/damage/biting, death/corpses/decomposition, full plant lifecycle (`seed → sprout → mature → flowering → fruiting → senescence`), pollination & endozoochorous seed dispersal                         | `src/life/`, `src/plants/`                            |
| **Evolution & Learning**  | Bounded Gaussian blueprint mutation, uniform crossover, asexual & sexual energy-conserving reproduction, `@oxyrlab/neuro-learn` (`RescorlaWagner`, `EligibilityTrace`, `Hebbian`, `MlpSgd`), `nn-controller`, `threat-memory`, event-driven `hormone.reward` / `hormone.aversive` pulses | `src/genome/`, `src/brain/learning/`, `src/brain/nn/` |
| **Built-In Species**      | Registered canonical species: `grass`, `berry-bush`, `rabbit` (reference animal), `fox`                                                                                                                                                                                                  | `src/species/`, `docs/catalog/species/`               |
| **Simulation & Worker**   | Fixed-timestep `Simulation`, tick-stamped `CommandQueue`, `ScenarioConfig` JSON save/load/replay, live `inspectEntity`/`pickEntity`, `StatsHistory` + CSV export, Comlink `SimWorkerApi` with Transferable snapshots & heatmaps                                                          | `src/sim/`                                            |
| **Renderer & HUD UI**     | PixiJS v8 viewport-culled renderer with cached procedural species sprites, field heatmap overlays, selection ring, accessible modular HUD (playback, Sandbox Spawn/Remove/Brush tools, live SVG population chart, collapsible Entity Inspector)                                          | `src/render/`, `src/ui/`, `src/main.ts`               |
| **Headless CLI & Bench**  | Node batch runner (`npm run headless`) with JSON/CSV export and target-scale profiler (`npm run bench`)                                                                                                                                                                                  | `src/headless/`, `scripts/bench-scale.ts`             |

### Verified Baseline Metrics (End of Milestone 1)

- **Automated Test Suite:** `138` test files / `375` tests passing (`unit`, `contract`, `integration`, `scenario` with real Rapier WASM).
- **Code Coverage:** `98.29%` Stmts · `92.92%` Branch · `99.10%` Funcs · `99.20%` Lines (`>= 90%` enforced on every core/sim/ui/headless module).
- **Target-Scale Performance (`npm run bench`):** `8.00 ms` mean tick (`7.00 ms` min) for **500 animals + 500 plants + 100 objects** on real Rapier WASM (down from `18.86 ms` baseline; meets the `<= 8 ms` Section 7 budget).
- **Architecture Decisions:** 10 recorded ADRs ([ADR 0001](adr/0001-use-rapier.md) through [ADR 0010](adr/0010-learning-neuromodulators.md)).

## 3. Essential Technical Invariants for Ongoing Development

Any new feature added in Milestone 2 **must preserve** these invariants:

1. **Strict Determinism:** Never call `Math.random()`, `Date.now()`, or `performance.now()` inside deterministic layers (`src/core` through `src/sim` — enforced by ESLint). Use injected `SeededRng`, iterate entities in ascending `EntityId` order, and route all external/UI mutations through tick-stamped `CommandQueue` ([ADR 0009](adr/0009-deterministic-sandbox-commands.md)).
2. **Modular Isolation:** Brain modules communicate **only** via `SignalBus` ports and hormones — never direct World/ECS access. Keep rendering (`src/render/`) and DOM HUD (`src/ui/`) decoupled from simulation state via Transferable snapshots and Comlink RPC.
3. **Energy Conservation:** Every energy creation, feeding transfer, reproduction split, death/corpse conversion, and decomposition must balance in `EnergyLedger`.
4. **No Hard-Coded Limits:** Express numeric caps/floors as registered Constraint Rules in `src/rules/defs/` with `rationale` and Layer 1 defaults in `src/config/rules.default.ts` ([ADR 0007](adr/0007-limits-as-rules.md)).
5. **Pulse Fidelity vs. Sensor Rates:** Analog-output sensors (`vision-sensor`, `olfactory-sensor`) may run at `sampleRateHz` (`10 Hz`) with deterministic staggering because `SignalBus.swap()` carries analog channels forward. Brain modules tick every physics tick so 1-tick inter-module `pulse` chains (e.g. `forage:bite → arbiter:action.bite → spine:mouth.bite`) are never dropped.
6. **Component Size & Quality Gates:** Keep files small and single-responsibility. Every runtime file under `src/` (excluding thin DOM/CLI entrypoints) requires a sibling `.test.ts` and TSDoc on all public exports. After adding any registered component, run `npm run docs:catalog`.

## 4. Extension Points & Developer Commands

| Goal                              | Primary Entry Point / Guide                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Add a new species                 | [guides/add-species.md](guides/add-species.md) · reference: `src/species/rabbit/`                                                      |
| Add a sensor / organ / shape      | [guides/add-sensor.md](guides/add-sensor.md) · [guides/add-organ.md](guides/add-organ.md) · [guides/add-shape.md](guides/add-shape.md) |
| Add a brain or learning module    | [guides/add-brain-module.md](guides/add-brain-module.md) · [guides/add-learning-module.md](guides/add-learning-module.md)              |
| Add or tune a Constraint Rule     | [guides/add-rule.md](guides/add-rule.md) · `src/config/rules.default.ts`                                                               |
| Extend Sandbox UI or Headless CLI | [guides/sandbox-and-headless.md](guides/sandbox-and-headless.md) · `src/ui/`, `src/headless/`                                          |

```bash
# Live browser app (PixiJS + Sandbox HUD + Web Worker)
npm run dev

# Full quality gate (format, types, lint, coverage, docs, production build)
npm run format:check && npm run typecheck && npm run lint && npm run test:coverage && npm run docs:check && npm run build

# Regenerate component catalogs after adding/updating registries
npm run docs:catalog

# Headless deterministic experiment & target-scale benchmark
npm run headless -- --seed 42 --ticks 600 --scenario default --format csv --out reports/run.csv
npm run bench
```

## 5. Milestone 2 — Completed Phases & Upcoming Roadmap

### Completed in Milestone 2

1. **Visual Overhaul (Groups 1–4):**
   - High-DPI top-down layered vector sprites for `rabbit` and `fox` (`src/render/species-shapes.ts`).
   - 6-stage visual sprites (`seed → sprout → mature → flowering → fruiting → senescence`) for `grass` and `berry-bush` (`src/render/plant-shapes.ts`, `src/plants/spawn.ts`).
   - Distinct sprites for `fruit`, `corpse` (shrinking with decomposition), and `rock`/`body` (`src/render/object-shapes.ts`, `src/life/death.ts`, `src/life/decomposition.ts`).
   - Organic dark-meadow terrain with deterministic moss/soil patches safe across any arena size (`src/render/terrain.ts`, `src/render/renderer.ts`).

2. **Organ-Based Biological Sex & Reproductive Signaling:**
   - Added lightweight torso-anchored organs `reproductive-male` and `reproductive-female` + `ReproductiveOrganComponent` (`src/body/organs/reproductive-organ.ts`, zero extra Rapier colliders) and `reproductive-sensor` (`src/body/sensors/reproductive-sensor.ts`) emitting `contact`, `mate.near`, `mate.dir`, and `ready`.
   - Enforced complementary-organ pairing and optional physical organ contact (`requireOrganContact`) in `stepReproductionSystem` (`src/genome/reproduction.ts`), surfaced organ state in `inspectEntity` / Inspector UI, and rendered a subtle sex marker spot on animals (blue = male, pink = female).

3. **Allometric Physics, Natural Locomotion & Ecological Calibration:**
   - Calibrated 2D areal densities (`rabbit ≈ 1.53 kg`, `fox ≈ 5.0 kg`), terrestrial damping (`linearDamping = 2.8`, `angularDamping = 5.5`), decoupled `differential-drive` turning (`differentialTurnScale: 0`), natural `move → pause → turn` wandering (`src/brain/modules/random-wander.ts`), and alignment-gated foraging/hunting (`src/brain/modules/seek-gradient.ts`, `src/species/fox/hunt-prey.ts`).
   - Added allometric actuator scaling (`thruster` force `∝ scale²`, `rotator` torque `∝ scale⁴`) and closed-loop angular-velocity rate control (`Kp = 2.5`) in `src/body/actuators/{thruster,rotator}.ts` + `src/species/creature-runtime.ts`, eliminating rapid spinning in both adults (`1,225 deg/s → 17 deg/s`) and juveniles (`17.6 deg/s`).
   - Added deterministic individual variation on spawn (`initialEnergyRange`, `initialAgeRange`, `maxAgeRange`, `adultScaleRange: [0.85, 1.15]`), juvenile newborn sizing (`juvenileScale = 0.48`), live growth sync in `stepAgingSystem`, and calibrated metabolism/lifespan to `10 sim s = 1 ecological day`.
   - Fixed shared mutable `actuatorPos` bug on `bite` emission and added post-fruiting rest cooldown + natural crowding density for `grass`.

4. **Shared Scenario Registry, HUD Controls & Ecological Benchmark Suite:**
   - Built `src/sim/scenario-registry.ts` shared by the HUD **Scenario Dropdown** + **`Seed` input / `Random Seed` / `Reset`** controls (`src/ui/panels/sandbox-toolbar.ts`, `src/main.ts`) and the high-speed headless validator (`src/headless/benchmark.ts`, `scripts/run-benchmarks.ts`, `npm run bench:ecology`).
   - Built-in scenarios: `default-meadow`, `rabbit-starvation-5` (5 rabbits: 3♀, 2♂, 0 plants), `rabbit-foraging-5` (control meadow), `rabbit-reproduction-5` (compact 10×10 m breeding & juvenile growth glade), and `empty-sandbox`.
   - **Verified Benchmark Results (`seed = 42`, real Rapier WASM):**
     - `rabbit-starvation-5` (`224 ms`): `5 → 0`, `100%` starvation (`0` aging, `0` births), `LT50 = 83.0 s` (`-7.8%` vs. 9-day _Oryctolagus cuniculus_ reference), `spread = 13.4 s`, `mean |ω| = 17.1 deg/s`, `EnergyLedger Δ = -0.00009 EU`.
     - `rabbit-foraging-5` (`659 ms`): `5 → 5` (`0%` mortality), `mean |ω| = 19.2 deg/s`, `peak |ω| = 180.0 deg/s`, `EnergyLedger Δ = -0.00971 EU`.
   - **Verified Test Suite:** `145` test files / `386` tests passing, `docs:catalog` (`6` organs, `5` sensors), `typecheck`, `lint`, `docs:check`, and `vite build` green.

### Next Planned Phases (Pending Prioritization)

- **Wall/obstacle perception & avoidance** (vision/whisker boundary awareness so creatures steer smoothly out of corners).
- **Mate-seeking behavior module (`seek-mate`)** wired to `reproductive-sensor` signals (`mate.near`, `mate.dir`, `ready`).
- **Additional ecological benchmark scenarios** (predator-prey dynamics, carrying capacity, multi-generation evolution).
- **Architectural Change Rule:** Any requirement that modifies core invariants or existing ADRs must be discussed and recorded as a new ADR (`docs/adr/0011-*.md`) before implementation.
