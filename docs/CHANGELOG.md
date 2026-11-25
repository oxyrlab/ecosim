# Changelog

All notable changes to EcoSim, including any changes to default Constraint Rule values (with benchmark results), are recorded here.

## [Unreleased]

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
