# Project Status

- **Current Phase:** Phase 5 — First Ecosystem (**Complete**)
- **Next Phase:** Phase 6 — Evolution and Learning (**BLOCKED — awaiting user design decision**)
- **Verification Snapshot:** 115 test files / 287 tests passing; 98.46% Stmts, 93.66% Branch, 99.11% Funcs, 99.45% Lines; `typecheck`, `lint`, `docs:check`, and `build` all green.
- **Last Updated:** 2026-11-26

## Completed in Phase 5

- **Shared Brain Modules (`src/brain/modules/`):** implemented and registered `hunger-drive` (publishing `hormone.satiety`), `seek-gradient` (vision + stereo olfactory tracking + close-range `bite`), `random-wander` (deterministic seeded exploration), and `behavior-arbiter` (named `behavior` bundle slot priority selection).
- **Species Blueprints, EntityFactory & Nervous Runtime (`src/species/`):** implemented Zod-validated `SpeciesBlueprint` (`AnimalSpeciesBlueprint` / `PlantSpeciesBlueprint`) + `speciesRegistry`, `validateAnimalBlueprint` (enforcing all 15 Constraint Rules, layout resolution, and SignalBus wiring), `spawnSpeciesEntity`, multi-body `World.removeEntity` cleanup, `CreatureBrainComponent` + `stepNervousSystem`, and `stepEcosystemTick` + `computeWorldStateHash`.
- **4 Built-in Species (`src/species/`):**
  - Plants: `grass` (self-pollinating meadow grass), `berry-bush` (fruiting shrub with animal seed dispersal)
  - Animals: `rabbit` (canonical reference herbivore with `rabbit-flee-predator` reflex) and `fox` (carnivore predator with articulated tail and `fox-hunt-prey` module)
- **Scenario & Contract Tests:** updated `tests/contracts/registry-contracts.test.ts` to automatically run `runBrainModuleContract` over all 6 registered brain modules; added `tests/scenarios/first-ecosystem.test.ts` verifying bit-exact determinism, exact `EnergyLedger` conservation, zero `NaN`/`Infinity`, zero Rapier handle leaks, and emergent flight/pursuit/foraging/fruiting behavior.
- **Docs & Catalogs:** added canonical `docs/guides/add-species.md`, extended `scripts/gen-catalog.ts` & `scripts/check-docs.ts` to auto-generate `docs/catalog/species/*.md` and `docs/catalog/brain-modules.md`, and added 90% coverage thresholds for `src/species/**/*.ts`.

## Exact Next Task (Phase 6 — Evolution and Learning)

> **HARD STOP / MANDATORY BLOCKER:** Under **no circumstances** start writing Phase 6 code until the user has explicitly discussed and decided **Open Design Question #1 (Learning triggers / neuromodulators)** below and the decision has been recorded in an ADR (e.g. `docs/adr/0010-learning-neuromodulators.md`). Begin the next session by discussing those 4 questions with the user first.

1. **First (mandatory):** Align with the user on Open Design Question #1 and record the agreed architecture in ADR `0010`.
2. Implement `src/genome/`: genome parameter extraction, mutation operators, asexual & sexual reproduction (with `EnergyLedger.recordReproduction` energy conservation and Constraint Rule re-validation of mutated offspring Blueprints).
3. Implement `src/brain/learning/` (reusing or wrapping `@oxyrlab/neuro-learn` per ADR 0008): `Learner` contract (`rescorla-wagner`, `eligibility-trace`, `hebbian`, `mlp-sgd` with numerical gradient check), `nn` module support, and `threat-memory` conditioning module (with appearance features in `vision-sensor`).
4. Add learning Constraint Rules and contract/integration tests (`runLearningModuleContract`, conditioning/extinction/generalization, learned fear without `predator` tag, non-inheritance of learned memory).

## Open Design Questions

> **STRICT RULE:** Do NOT implement Phase 6 or any open design question before it is discussed with the user, explicitly approved, and recorded in an ADR.

### 1. Learning triggers / neuromodulators (**MUST DECIDE BEFORE PHASE 6**)

- Which simulation events release which neuromodulators (`hormone.reward`, `hormone.aversive`, etc.) — eating, mating, pain, fear, satiety?
- What strength and pulse duration should each modulator release have?
- Should modulators emit raw affective values or prediction errors (actual minus expected outcome, mirroring dopamine RPE)?
- Should modulators also influence non-learning behavior directly (e.g. reward suppressing fear)?

## Open Issues & Technical Debt

- None in Phases 0–5.
- Phase 7 includes the interactive Sandbox / World Editor UI built on `CommandQueue` ([ADR 0009](adr/0009-deterministic-sandbox-commands.md)).
- `@oxyrlab/neuro-learn` (`../neuro-learn`) is ready at `v0.1.0` for Phase 6 integration ([ADR 0008](adr/0008-in-house-learning.md)).
