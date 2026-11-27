# Genome, Mutation & Reproduction

EcoSim represents an animal's heritable genome directly inside its validated `AnimalSpeciesBlueprint` together with an explicit `MutationSpec` and `ReproductionSpec` (`src/genome/`).

## Mutation & Crossover (`src/genome/mutation.ts`)

- **`MutableGeneSpec`**: identifies a dot-separated numeric path inside the Blueprint (`path`, `min`, `max`, `sigma`, optional `integer`), such as `metabolism.basalRatePerKgPerSecond` or `brain.modules.2.params.learningRate`.
- **`mutateBlueprint(blueprint, mutation, rng)`**: deep-clones the parent Blueprint (`structuredClone`) and applies bounded Gaussian perturbations (`rng.nextGaussian(0, sigma)`) to each listed gene with probability `mutation.rate`.
- **`crossoverBlueprints(parentA, parentB, mutation, rng)`**: performs uniform per-gene crossover between two conspecific parents and then applies `mutateBlueprint`.

## Reproduction & Energy Conservation (`src/genome/reproduction.ts`)

`stepReproductionSystem(world, dt, ledger)` supports both `'asexual'` and `'sexual'` modes:

- Parents must be alive, mature (`ageSeconds >= maturityAgeSeconds`), off cooldown, and hold sufficient energy.
- Candidate offspring Blueprints are re-validated via `validateAnimalBlueprint` so mutated genes that violate error-level Constraint Rules (e.g. `learning-rate-bounds`) are rejected cleanly.
- **Exact Energy Conservation**: parents pay `offspringEnergy + offspringStructuralEnergy + overheadCost` (split 50/50 in sexual mode), logged via `ledger.recordReproduction(offspringTotalEu, overheadCost)`.
- **Non-inheritance of learned memory (ADR 0008)**: offspring are instantiated fresh via `spawnSpeciesEntity`, so only heritable Blueprint parameters (`learningRate`, `memorySlots`, etc.) pass down — lifetime learned weights always start empty.
