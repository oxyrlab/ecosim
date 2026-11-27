# Changelog

All notable changes to EcoSim, including any changes to default Constraint Rule values (with benchmark results), are recorded here.

## [Unreleased]

### Added & Optimized — Phase 8 (Optimization & Procedural Canvas Rendering)

- Added target-scale & micro-benchmark runner (`scripts/bench-scale.ts`, `npm run bench`) and deterministic scale stress test (`tests/scenarios/scale-budget.test.ts`).
- Optimized `SpatialHash` (`src/world/spatial-hash.ts`) with integer-packed cell keys, direct entry buckets, in-place same-cell updates, and monotonic `queryStamp` deduplication (`4.15 ms → 1.20 ms`, **3.46× faster**).
- Added `PhysicsBodyData.isFixed` (`src/world/components.ts`, `src/world/world.ts`, `src/plants/lifecycle.ts`) to skip immovable plants/fruits in `syncFromPhysics()`, removed per-plant `{ col, row }` allocations in `GridField.addAtWorld` and `stepPhotosynthesisSystem`, and added an already-sorted fast path in `EcsWorld.query()` (`src/core/ecs.ts`).
- Eliminated per-creature closures in `stepNervousSystem` (`src/species/creature-runtime.ts`) and enforced declared sensor `sampleRateHz` with deterministic per-entity staggering while keeping brain modules ticking every tick for lossless pulse propagation.
- **Target-Scale Benchmark (500 animals + 500 plants + 100 objects, real Rapier WASM):** mean tick time dropped from **`18.86 ms`** (max `22.56 ms`) to **`8.00 ms`** (min `7.00 ms`, max `11.03 ms`), meeting the Section 7 `<= 8 ms` budget with all default Constraint Rules unchanged.
- Connected procedural species layouts (`src/render/species-shapes.ts`) and `AppearanceTextureCache` + pooled PixiJS `Sprite`s to `EcoSimRenderer` (`src/render/renderer.ts`).

### Added — Phase 7 (Observation & Sandbox Tools)

- Added `src/sim/scenario.ts` (Zod-validated `ScenarioConfig`, `createDefaultMeadowScenario`, `createEmptySandboxScenario`, JSON save/load, and deterministic tick-stamped command replay per [ADR 0009](adr/0009-deterministic-sandbox-commands.md)).
- Added `src/sim/inspector.ts` (`inspectEntity`, `pickEntityAtWorldPos`) and `src/sim/stats.ts` (`collectSimulationStats`, `collectGenomeSummary`, `StatsHistory`, `statsHistoryToCsv`).
- Upgraded `SimCommand` (`spawn-species`, `clear-world`), `Simulation` (full ecosystem loop, `EnergyLedger`, `FieldHeatmapSnapshot`, Scenario replay/export), and `SimWorkerApi` RPCs.
- Added `src/render/heatmap.ts` and upgraded `EcoSimRenderer` with field heatmap overlays, entity selection rings, and brush drag mode.
- Added modular Observation & Sandbox HUD (`src/ui/`: `sandbox-state.ts`, `chart-svg.ts`, `inspector-format.ts`, `hud.ts`, `hud.css`, and `panels/{playback-bar,sandbox-toolbar,inspector-panel,toolbar-a11y}.ts`) wired into `src/main.ts`.
- Added headless CLI runner (`src/headless/runner.ts`, `src/headless/run.ts`, `npm run headless`) with JSON/CSV export, real Rapier integration tests (`tests/integration/sandbox-and-headless.test.ts`), 90% coverage thresholds for `src/ui/` and `src/headless/`, and `docs/guides/sandbox-and-headless.md`.

### Added — Phase 6 (Evolution and Learning)

- Recorded [ADR 0010](adr/0010-learning-neuromodulators.md) (simple event-driven `hormone.reward` / `hormone.aversive` neuromodulators gating learning only).
- Added `src/genome/`: `mutateBlueprint`, `crossoverBlueprints`, `ReproductionComponent`, and energy-conserving asexual + sexual `stepReproductionSystem`.
- Added `extractAppearanceFeatures` (`src/appearance/features.ts`) and `features: true` appearance-feature outputs in `vision-sensor`.
- Integrated `@oxyrlab/neuro-learn` in `src/brain/learning/` and `src/brain/nn/`: `runLearnerContract` for all 4 learners + `mlp-sgd` numerical gradient check, `nn-controller` (`kind: 'nn'`), `threat-memory` (`kind: 'learning'` with conditioning, RBF generalization, and extinction), and ADR 0010 neuromodulator pulse helpers.
- Registered all 4 learning Constraint Rules (`max-learner-state-size`, `max-memory-slots`, `learning-rate-bounds`, `learning-max-updates-per-second` — 19 total rules) with defaults in `src/config/rules.default.ts`.
- Added `runLearningModuleContract`, real Rapier WASM learned-fear & reproduction integration tests (`tests/integration/evolution-and-learning.test.ts`), 90% coverage thresholds for `src/genome/**/*.ts`, and `docs/concepts/{genome,learning}.md` + `docs/guides/add-learning-module.md`.

### Added — Phase 5 (First Ecosystem)

- Added shared brain modules (`src/brain/modules/`): `hunger-drive`, `seek-gradient`, `random-wander`, and `behavior-arbiter` (named `behavior` bundle slots).
- Added `src/species/`: `SpeciesBlueprint` + `speciesRegistry`, `validateAnimalBlueprint` + `spawnSpeciesEntity`, multi-body `World.removeEntity` handle cleanup, `CreatureBrainComponent` + `stepNervousSystem`, `stepEcosystemTick` + `computeWorldStateHash`, and 4 built-in species (`grass`, `berry-bush`, canonical reference `rabbit` with `rabbit-flee-predator`, and `fox` with `fox-hunt-prey`).
- Added balanced real-Rapier ecosystem scenario tests (`tests/scenarios/first-ecosystem.test.ts`), automatic brain-module registry contract tests, 90% coverage thresholds for `src/species/**/*.ts`, `docs/guides/add-species.md`, and auto-generated `docs/catalog/species/*.md`.

### Added — Phase 4 (Plants)

- Added `src/plants/`: `PlantComponent`, `FruitComponent`, `plantSpeciesSpecSchema` / `parsePlantSpeciesSpec`, `spawnPlant` / `spawnFruit`, `stepPhotosynthesisSystem`, `stepPlantLifecycleSystem` (full state machine + organ growth + collider resizing), `stepPollinationSystem`, `stepFruitSystem` / `recordFruitBites`, and `stepSeedDispersalSystem`.
- Added 90% per-module coverage thresholds for `src/plants/**/*.ts`, unit tests for every module, and real Rapier WASM integration tests (`tests/integration/plant-cycle.test.ts`) covering full plant generation turnover, endozoochorous seed dispersal, closed nutrient recycling, and exact `EnergyLedger` conservation.
- Added `docs/concepts/plants.md` and updated `docs/README.md` & `docs/STATUS.md`.

### Added — Phase 3 (Life)

- Added `src/life/`: `EnergyComponent`, `LifecycleComponent`, `HealthComponent`, `DietComponent`, `CorpseComponent`, auditable `EnergyLedger` + `computeWorldEnergy`, `stepAgingSystem`, `stepMetabolismSystem`, `stepHealthSystem`, `stepInteractionSystem`, `stepDeathSystem`, and `stepDecompositionSystem`.
- Added internal proprioceptive sensors `energy-sensor` (`level`, `deficit`) and `pain-sensor` (`pain`, `health`) in `src/body/sensors/` wired via `SensorContext.bodyState`.
- Added 90% per-module coverage thresholds for `src/life/**/*.ts`, full unit tests, updated registry contract tests, and real Rapier WASM lifecycle + exact `EnergyLedger` integration tests (`tests/integration/life-cycle.test.ts`).
- Added `docs/concepts/metabolism.md` and `docs/concepts/lifecycle.md`, and regenerated `docs/catalog/sensors.md`.

### Added — Phase 2 (Nervous System)

- Added `src/bus/`: double-buffered `Float32Array` `SignalBus`, typed `port` builders (`analog`, `pulse`, `bundle('behavior')`), broadcast hormones (`HORMONE_SPECS`), and static wiring resolver (`resolveWiring`, `inspectWiring`).
- Added typed `define*` / `register*` helpers and registries for organs (`src/body/organs`), sensors (`src/body/sensors`), actuators (`src/body/actuators`), brain modules (`src/brain`), and spines (`src/spine`).
- Added initial components: `body-core`, `eye`, `nose`, `mouth`, `vision-sensor`, `olfactory-sensor`, `thruster`, `rotator`, `bite`, and `differential-drive` spine.
- Registered all 7 nervous-system Constraint Rules (`max-sensors-per-creature`, `max-brain-modules`, `max-bus-channels`, `unmerged-fan-in`, `unconnected-input`, `unused-output`, `numeric-index-on-logical-port`) with defaults in `src/config/rules.default.ts`.
- Added contract suites (`runOrganContract`, `runSensorContract`, `runActuatorContract`, `runBrainModuleContract`, `runSpineContract`) and end-to-end Rapier nervous-system integration tests (`tests/integration/nervous-system.test.ts`).
- Added `docs/architecture/signal-bus.md`, `docs/concepts/{organ,sensor,actuator,brain,spine}.md`, `docs/guides/{add-organ,add-sensor,add-brain-module}.md`, and auto-generated catalogs for all registries.

### Added — Phase 1.5 (Appearance)

- Added primitive shape registry (`src/appearance/shapes/`) with all 7 shapes (`circle`, `ellipse`, `rect`, `capsule`, `triangle`, `polygon`, `convex`) and 2D convex hull / ear-clipping decomposition geometry helpers (`src/appearance/geometry.ts`).
- Added `ColorGene`, `BodyPartSpec`, `expandBodyParts` (mirroring + `$actuator:*`/`$sensor:*` resolution), `chain()` helper, pure `resolveLayout()`, and `buildPhysicsBodyFromLayout()` (`src/appearance/`).
- Registered all 8 initial appearance and physics Constraint Rules (`src/rules/defs/`) with Layer 1 defaults in `src/config/rules.default.ts`.
- Added purely visual animation evaluator (`src/render/animation.ts`) and `AppearanceTextureCache` (`src/render/texture-cache.ts`).
- Added `runShapeContract`, automatic registry contract suite, `cat` and `worm` Blueprint fixtures, and Rapier + Rules integration tests.

### Added — Phase 1 (World and Physics)

- Added deterministic Rapier 2D (WASM) adapter (`src/physics/`) behind `PhysicsAdapter`, plus `MockPhysicsAdapter` and WASM handle-leak tests.
- Added `World`, `GridField`, `FieldSet`, and `SpatialHash` (`src/world/`).
- Added fixed-timestep `Simulation`, tick-stamped `CommandQueue` (ADR 0009), compact Transferable `RenderSnapshot`, and Comlink Web Worker (`src/sim/`).
- Added pure 2D `Camera` with viewport culling and basic PixiJS v8 `EcoSimRenderer` (`src/render/`).

### Added — Phase 0 (Infrastructure)

- Initialized EcoSim project with Vite, strict TypeScript, ESLint (determinism rules), Prettier, and Vitest with coverage thresholds.
- Implemented `src/core/`, `src/rules/` engine, `src/config/`, `tests/helpers/`, `docs/` foundation, and ADRs 0001–0008.
