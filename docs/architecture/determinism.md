# Determinism

EcoSim guarantees that running the same scenario with the same integer `worldSeed` produces the exact same simulation trajectory across runs.

## Rules

1. **No ambient randomness or wall-clock time** in simulation layers (`src/core`, `src/config`, `src/rules`, `src/appearance`, `src/physics`, `src/world`, `src/bus`, `src/body`, `src/brain`, `src/spine`, `src/life`, `src/plants`, `src/genome`, `src/species`, `src/sim`). ESLint rejects `Math.random()`, `Date.now()`, and `performance.now()`.
2. **Seeded PRNG (`src/core/rng.ts`):** All randomness flows through an injected `SeededRng` (mulberry32). Entity streams are derived deterministically via `deriveEntitySeed(worldSeed, entityId)`.
3. **Deterministic iteration order:**
   - `Registry` preserves insertion order.
   - `EcsWorld.query()` sorts matching entity ids in ascending numerical order regardless of component attachment order.
4. **Fixed timestep:** Simulation steps advance by `SIMULATION_DEFAULTS.fixedTimestepSeconds` (`1/30 s`), never by variable frame deltas.
5. **Visual/simulation boundary:** Animations, camera culling, and rendering run purely on snapshots and never mutate simulation state.
