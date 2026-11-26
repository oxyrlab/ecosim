# Project Status

- **Current Phase:** Phase 3 — Life (**Complete**)
- **Next Phase:** Phase 4 — Plants
- **Last Updated:** 2026-11-26

## Completed in Phase 3

- **Life Components (`src/life/components.ts`):** added `EnergyComponent`, `LifecycleComponent`, `HealthComponent`, `DietComponent`, and `CorpseComponent` ECS definitions.
- **Energy Conservation (`src/life/energy-ledger.ts`):** implemented `EnergyLedger` (tracking `initialSpawn`, `lightInput`, `basalMetabolism`, `actuatorWork`, `brainUpkeep`, `feedingWaste`, `reproductionCost`, and internal transfers) and `computeWorldEnergy` for exact conservation auditing.
- **Metabolism, Aging & Health (`src/life/{metabolism,aging,health}.ts`):** implemented mass-scaled basal + brain + actuator energy consumption with senescence efficiency decline, starvation damage, linear juvenile-to-adult growth `computeGrowthScale`, aging mortality, and queued damage / one-tick `recentPainPulse` resolution.
- **Predation, Death & Decomposition (`src/life/{interaction,death,decomposition}.ts`):** implemented bite interaction resolution (damage, energy transfer, assimilation efficiency, corpse scavenging), clean death-to-corpse conversion (releasing Rapier handles without leaks), and gradual corpse decomposition into `soil.nutrients` + `scent.corpse`.
- **Internal Proprioceptive Sensors (`src/body/sensors/{energy,pain}-sensor.ts`):** extended `SensorContext` with optional `bodyState` (`InternalBodyState`) and registered `energy-sensor` (`level`, `deficit`) and `pain-sensor` (`pain` pulse, `health`).
- **Tests & Docs:** added unit tests for every `src/life/` module and both new sensors, updated automatic registry contracts (4 registered sensors), added real Rapier WASM lifecycle + exact `EnergyLedger` integration tests (`tests/integration/life-cycle.test.ts`), and added `docs/concepts/metabolism.md` & `docs/concepts/lifecycle.md`.

## Exact Next Task (Phase 4 — Plants)

1. Implement `src/plants/`:
   - **Plant components & photosynthesis:** absorb light from the `light` field and nutrients from `soil.nutrients` (plus moisture when present) to grow biomass/energy, logging solar inflow to `EnergyLedger.recordLightInput`.
   - **Growth, reproduction & fruiting:** mature plants produce seeds or fruit carrying energy and `scent.fruit`; seed dispersal and germination with overcrowding competition.
   - **Plant visual layout & rules:** species presets (e.g. grass/bush/tree or herb/berry bush) compatible with appearance rendering and herbivore grazing/biting.
2. Add unit and integration tests (plant growth from light + soil nutrients, fruit/seed spawning, herbivore eating plant, closed nutrient loop `plant -> herbivore -> corpse -> soil.nutrients -> plant` audited by `EnergyLedger`).

## Open Design Questions

> Do not implement any open design question before it is decided and recorded in an ADR.

### 1. Learning triggers / neuromodulators (decide before Phase 6)

- Which simulation events release which neuromodulators (`hormone.reward`, `hormone.aversive`, etc.) — eating, mating, pain, fear, satiety?
- What strength and pulse duration should each modulator release have?
- Should modulators emit raw affective values or prediction errors (actual minus expected outcome, mirroring dopamine RPE)?
- Should modulators also influence non-learning behavior directly (e.g. reward suppressing fear)?

## Open Issues & Technical Debt

- None in Phase 3.
- Phase 7 includes the interactive Sandbox / World Editor UI built on `CommandQueue` ([ADR 0009](adr/0009-deterministic-sandbox-commands.md)).
- `@oxyrlab/neuro-learn` (`../neuro-learn`) is ready at `v0.1.0` for Phase 6 integration ([ADR 0008](adr/0008-in-house-learning.md)).
