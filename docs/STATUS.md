# Project Status

- **Current Phase:** Phase 4 — Plants (**Complete**)
- **Next Phase:** Phase 5 — First Ecosystem
- **Last Updated:** 2026-11-26

## Completed in Phase 4

- **Plant & Fruit Components (`src/plants/components.ts`, `src/plants/spawn.ts`):** added `PlantComponent` (`kingdom: 'plant'`, lifecycle stages, growing `stemLength`/`leafArea`/`flowerCount`, carrier dispersal state), `FruitComponent` (independent entity with `tags: ['fruit']`, flesh energy + internal seed energy), Zod-validated `plantSpeciesSpecSchema` / `parsePlantSpeciesSpec`, and `spawnPlant` / `spawnFruit`.
- **Photosynthesis & Lifecycle (`src/plants/photosynthesis.ts`, `src/plants/lifecycle.ts`):** implemented nutrient-limited photosynthesis from `light`, `soil.nutrients`, and `soil.moisture` (logging solar inflow via `EnergyLedger.recordLightInput`), full state machine (`seed → sprout → mature → flowering → fruiting → senescence → death`), crowding check on germination, organ growth, and leak-free collider radius resizing via `PhysicsAdapter`.
- **Pollination, Fruiting & Seed Dispersal (`src/plants/{pollination,fruit,dispersal}.ts`):** implemented same-species distance pollination (`pollinationRadiusMeters`), energy-conserving fruit spawning, `recordFruitBites` integration with `stepInteractionSystem`, endozoochorous seed carrying/excretion after `dispersalDelaySeconds`, and expired-fruit germination or decomposition into `soil.nutrients`.
- **Tests & Docs:** added unit tests for all 6 modules in `src/plants/`, 90% coverage thresholds in `vitest.config.ts`, real Rapier WASM integration tests (`tests/integration/plant-cycle.test.ts`) proving full plant generation turnover, herbivore seed dispersal, closed nutrient recycling, exact `EnergyLedger` conservation, and zero handle leaks, plus `docs/concepts/plants.md`.

## Exact Next Task (Phase 5 — First Ecosystem)

1. Implement shared behavioral brain modules (`src/brain/modules/`):
   - `hunger-drive`, `seek-gradient`, `random-wander`, and `behavior-arbiter` (named slots + `behavior` bundle).
2. Implement initial ecosystem species (`src/species/`):
   - Plants: `grass`, `berry-bush`
   - Animals: `rabbit` (canonical reference species with `guides/add-species.md`; herbivore with species-specific brain/spine/appearance) and `fox` (predator).
3. Build a balanced scenario and scenario tests verifying invariants (no NaN/Infinity, exact `EnergyLedger` balance, deterministic state hash across identical seeds, stable populations).

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
