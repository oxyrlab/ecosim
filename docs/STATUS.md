# Project Status

- **Current Phase:** Phase 6 — Evolution and Learning (**Complete**)
- **Next Phase:** Phase 7 — Observation & Sandbox Tools
- **Last Updated:** 2026-11-27

## Completed in Phase 6

- **ADR 0010 (`docs/adr/0010-learning-neuromodulators.md`):** recorded the simple, event-driven neuromodulator architecture (`hormone.reward` on feeding/reproduction, `hormone.aversive` on damage/starvation, raw proportional pulses decaying in `< 0.5 s`, strictly gating learning only).
- **Genome, Mutation & Reproduction (`src/genome/`):** implemented bounded Gaussian Blueprint mutation (`mutateBlueprint`), uniform per-gene crossover (`crossoverBlueprints`), and energy-conserving asexual + sexual reproduction (`stepReproductionSystem`) with Constraint Rule re-validation and empty initial learning memory on offspring.
- **Appearance-Feature Vision (`src/appearance/features.ts`, `src/body/sensors/vision-sensor.ts`):** added normalized 5-D `AppearanceFeatures` (`size`, `hue`, `lightness`, `shape`, `parts`) exposed via `vision-sensor` (`features: true`) and `CreatureBrainComponent`.
- **Learning & Neural Modules (`src/brain/learning/`, `src/brain/nn/`):** integrated `@oxyrlab/neuro-learn` (`RescorlaWagnerLearner`, `EligibilityTraceLearner`, `HebbianLearner`, `MlpSgdLearner` with `runLearnerContract` + numerical gradient check), implemented `nn-controller` (`kind: 'nn'`) and `threat-memory` (`kind: 'learning'` with conditioning, RBF generalization, and extinction), plus ADR 0010 neuromodulator pulse helpers.
- **Learning Constraint Rules & Contracts (`src/rules/defs/`, `tests/contracts/`):** registered all 4 learning rules (`max-learner-state-size`, `max-memory-slots`, `learning-rate-bounds`, `learning-max-updates-per-second` — 19 total rules), added `runLearningModuleContract` running automatically on all `kind === 'learning'` modules, and added real Rapier WASM learned-fear & reproduction integration tests (`tests/integration/evolution-and-learning.test.ts`).
- **Docs & Catalogs:** added `docs/concepts/genome.md`, `docs/concepts/learning.md`, `docs/guides/add-learning-module.md`, regenerated all 12 catalog files, and added 90% coverage thresholds for `src/genome/**/*.ts`.

## Exact Next Task (Phase 7 — Observation & Sandbox Tools)

1. Build live Inspector UI (`src/ui/`): click any entity to inspect live `SignalBus` values, module `serialize()` state, energy, age, tags, and Constraint Rule violations.
2. Add live observation tools: population charts per species, field heatmaps (`scent.*`, `soil.nutrients`, `soil.moisture`, `light`), and simulation speed/pause/step controls.
3. Build the Interactive Sandbox / World Editor on top of tick-stamped `CommandQueue` ([ADR 0009](adr/0009-deterministic-sandbox-commands.md)): spawn/remove any registered species on click, environmental field brush, and custom scenario JSON save/load.
4. Implement headless CLI runner (`src/headless/run.ts`) supporting `--seed`, `--ticks`, `--scenario`, `--out` with CSV/JSON population/energy/event export.

## Open Design Questions

- None currently open. (Open Design Question #1 — Learning triggers / neuromodulators — was resolved and recorded in [ADR 0010](adr/0010-learning-neuromodulators.md).)

## Open Issues & Technical Debt

- None in Phases 0–6.
- Phase 7 builds the interactive Sandbox / World Editor UI on `CommandQueue` ([ADR 0009](adr/0009-deterministic-sandbox-commands.md)).
