# Project Status

- **Current Phase:** Phase 2 — Nervous System (**Complete**)
- **Next Phase:** Phase 3 — Life
- **Last Updated:** 2026-11-25

## Completed in Phase 2

- **SignalBus & Wiring (`src/bus/`):** implemented double-buffered `Float32Array` `SignalBus` (1-tick delay, range clamping, analog persistence, 1-tick pulse auto-reset, zero hot-loop allocations), `port.analog` / `port.pulse` / `port.bundle('behavior')`, broadcast hormones (`HORMONE_SPECS`), and `resolveWiring` (`<instanceId>:<port>`, fan-out, merged fan-in `sum|max|min|avg`, bundle expansion, hormone pub/sub, and static diagnostics).
- **Component Contracts & Registries:** added `defineOrgan`, `defineSensor`, `defineActuator`, `defineBrainModule`, `defineSpine` with typed `PortHandleMap` inference and global registries.
- **Initial Components (`src/body/`, `src/spine/`):**
  - Organs: `body-core`, `eye`, `nose`, `mouth`
  - Sensors: `vision-sensor` (sector FOV, SpatialHash, optional Rapier raycast occlusion, dynamic tag bearings), `olfactory-sensor` (stereo left/right bilinear intensity & signed gradient)
  - Actuators: `thruster`, `rotator`, `bite` (with cooldown, action events, and `EnergyCostModel`)
  - Spine: generic `differential-drive`
- **Nervous-System Constraint Rules (`src/rules/defs/`):** added all 7 nervous-system rules (`max-sensors-per-creature`, `max-brain-modules`, `max-bus-channels`, `unmerged-fan-in`, `unconnected-input`, `unused-output`, `numeric-index-on-logical-port`) with Layer 1 defaults in `src/config/rules.default.ts` (15 total registered rules).
- **Contracts & Integration Tests:** added `runOrganContract`, `runSensorContract`, `runActuatorContract`, `runBrainModuleContract`, `runSpineContract` (all running automatically over live registries), plus end-to-end Rapier integration tests (`vision -> bus -> brain -> spine -> mirrored visual thrusters -> Rapier` and `scent emit -> diffusion -> olfactory-sensor`).
- **Docs & Catalog:** added `docs/architecture/signal-bus.md`, `docs/concepts/{organ,sensor,actuator,brain,spine}.md`, `docs/guides/{add-organ,add-sensor,add-brain-module}.md`, and auto-generated all 7 catalog files in `docs/catalog/`.

## Exact Next Task (Phase 3 — Life)

1. Implement `src/life/`:
   - **Metabolism & Energy (`EnergyStore` + `MetabolismSystem`):** base consumption as a function of mass + actuator costs + brain upkeep cost.
   - **EnergyLedger:** auditable conservation tracking of all system inflows/outflows (light input, metabolism heat loss, bite transfer, corpse decomposition, reproduction transfer).
   - **Aging & Lifecycle (`AgingSystem`):** `age`, `maxAge`, maturity growth scale `scale(age)`, senescence efficiency decline.
   - **Health & Damage (`HealthSystem`):** bite damage, starvation damage, aging damage, and feeding/predation `InteractionSystem`.
   - **Death & Decomposition (`DeathSystem`, `DecompositionSystem`):** creature → `corpse` entity holding remaining energy → gradual release into `soil.nutrients` and `scent.corpse` → clean removal.
2. Add unit and integration tests (predator bite damage & energy transfer, death → corpse → decomposition → `soil.nutrients` increase, `EnergyLedger` balance check).

## Open Design Questions

> Do not implement any open design question before it is decided and recorded in an ADR.

### 1. Learning triggers / neuromodulators (decide before Phase 6)

- Which simulation events release which neuromodulators (`hormone.reward`, `hormone.aversive`, etc.) — eating, mating, pain, fear, satiety?
- What strength and pulse duration should each modulator release have?
- Should modulators emit raw affective values or prediction errors (actual minus expected outcome, mirroring dopamine RPE)?
- Should modulators also influence non-learning behavior directly (e.g. reward suppressing fear)?

## Open Issues & Technical Debt

- None in Phase 2.
- Phase 7 includes the interactive Sandbox / World Editor UI built on `CommandQueue` ([ADR 0009](adr/0009-deterministic-sandbox-commands.md)).
- `@oxyrlab/neuro-learn` (`../neuro-learn`) is ready at `v0.1.0` for Phase 6 integration ([ADR 0008](adr/0008-in-house-learning.md)).
