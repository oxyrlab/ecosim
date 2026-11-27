# Project Status

- **Current Phase:** Phase 7 — Observation & Sandbox Tools (**Complete**)
- **Next Phase:** Phase 8 — Optimization
- **Last Updated:** 2026-11-27

## Completed in Phase 7

- **Simulation Scenario, Inspector & Telemetry (`src/sim/`):**
  - Added Zod-validated `ScenarioConfig` (`src/sim/scenario.ts`) with `createDefaultMeadowScenario`, `createEmptySandboxScenario`, JSON save/load (`serializeScenario` / `parseScenarioJson`), and tick-stamped Sandbox command replay ([ADR 0009](adr/0009-deterministic-sandbox-commands.md)).
  - Added live entity inspection & picking (`src/sim/inspector.ts`: `inspectEntity`, `pickEntityAtWorldPos`) exposing `SignalBus` channel snapshots, brain module `serialize()` states, vitals, neuromodulators, tags, and Constraint Rule diagnostics.
  - Added simulation telemetry & CSV exporter (`src/sim/stats.ts`: `collectSimulationStats`, `collectGenomeSummary`, `StatsHistory`, `statsHistoryToCsv`).
  - Upgraded `Simulation` (`src/sim/simulation.ts`), `SimCommand` (`spawn-species`, `clear-world`), and `SimWorkerApi` (`src/sim/worker.ts`) with ecosystem ticking, `EnergyLedger` accounting, Transferable `FieldHeatmapSnapshot`s, and Scenario/Inspector/Stats RPCs.
- **Field Heatmap & Selection Rendering (`src/render/`):**
  - Added pure heatmap color-ramp mapper (`src/render/heatmap.ts`) and upgraded `EcoSimRenderer` (`src/render/renderer.ts`) with viewport-culled field heatmap overlays, selected-entity highlight rings, and continuous drag brushing.
- **Modular Observation & Sandbox HUD (`src/ui/`, `src/main.ts`):**
  - Split UI into small single-responsibility modules: pure logic (`sandbox-state.ts`, `chart-svg.ts`, `inspector-format.ts`) + accessible DOM panels (`playback-bar.ts`, `sandbox-toolbar.ts`, `inspector-panel.ts`, `toolbar-a11y.ts`, `hud.ts`, `hud.css`).
  - Wired Play/Pause/Step/Speed controls, Inspect/Spawn/Remove/Brush tools, Heatmap overlay selector, live SVG population chart, collapsible Entity Inspector, and Scenario JSON Save/Load in `src/main.ts`.
- **Headless CLI Runner (`src/headless/`):**
  - Added programmatic `runHeadlessSimulation`, `parseHeadlessArgs`, and `formatHeadlessOutput` (`src/headless/runner.ts`) plus thin Node CLI entry (`src/headless/run.ts`, `npm run headless`) supporting `--seed`, `--ticks`, `--scenario`, `--out`, `--format json|csv`, and `--sample-interval`.
- **Tests & Docs:**
  - Added real Rapier WASM integration tests (`tests/integration/sandbox-and-headless.test.ts`) proving bit-exact Sandbox JSON command replay, live SignalBus inspection, and deterministic headless runs with balanced `EnergyLedger`.
  - Added 90% coverage thresholds for `src/ui/**/*.ts` and `src/headless/**/*.ts`, plus [docs/guides/sandbox-and-headless.md](guides/sandbox-and-headless.md).

## Exact Next Task (Phase 8 — Optimization)

1. Profile at target scale (~500 animals, ~500 plants, ~100 other objects) in headless benchmarks and identify hot spots across physics, spatial hash, grid diffusion, sensors, brain stepping, and rendering.
2. Optimize hot paths (typed array pooling, zero-allocation hot loops, viewport culling / batching / texture-cache integration in PixiJS renderer) while preserving bit-exact determinism and >= 90% coverage.
3. Tune default Constraint Rule thresholds in `src/config/rules.default.ts` ONLY if backed by benchmark evidence, recording results in `docs/CHANGELOG.md`.

## Open Design Questions

- None currently open.

## Open Issues & Technical Debt

- None in Phases 0–7.
