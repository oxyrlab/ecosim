# Lifecycle, Health, Death & Decomposition

Every living entity progresses through growth, maturity, senescence, death, and nutrient recycling back into the world's `soil.nutrients` field.

## Aging, Growth & Senescence (`src/life/aging.ts`)

`LifecycleComponent` (`LifecycleData`) tracks age in SI seconds and drives two pure curves:

1. **Growth scale `computeGrowthScale(lifecycle)`**: linearly interpolates from `juvenileScale` at age `0` to `adultScale` at `maturityAgeSeconds`, remaining constant afterward.
2. **Metabolic efficiency `computeMetabolicEfficiency(lifecycle)`**: remains `1.0` until `senescenceStartFraction * maxAgeSeconds`, then declines linearly to `minSenescenceEfficiency` at `maxAgeSeconds`. Lower efficiency raises basal metabolic cost (`basal / efficiency`).

`stepAgingSystem(world, dt)` increments `ageSeconds`, updates `currentScale` and `efficiency`, and marks entities with `ageSeconds >= maxAgeSeconds` as dead (`deathCause = 'aging'`).

## Health, Damage & Pain (`src/life/health.ts`)

`HealthComponent` (`HealthData`) buffers incoming damage in `pendingDamage` (queued by predation bites or starvation). `stepHealthSystem(world)`:

1. Resolves `pendingDamage` against `health.current` (clamping to `[0, max]`).
2. Computes a one-tick normalized `recentPainPulse = clamp(appliedDamage / health.max, 0, 1)`.
3. Marks `dead = true` when `health.current <= 0` (preserving `'starvation'` if set, otherwise recording `'damage'`).

`pain-sensor` (`src/body/sensors/pain-sensor.ts`) publishes `recentPainPulse` as a one-tick `pulse` port (`pain`) and `health.current / health.max` as an analog port (`health`) on the creature's `SignalBus`.

## Death & Corpse Conversion (`src/life/death.ts`)

`stepDeathSystem(world, ledger, config)` processes every entity with `HealthComponent.dead === true`:

1. Computes total residual energy `corpseEnergy = energy.current + energy.structuralEnergy` (if `EnergyComponent` is present).
2. Removes the dead entity cleanly from `World` (ECS entity + Rapier physics body, preventing WASM handle leaks).
3. If `corpseEnergy > 0`, spawns a `corpse` entity at the death position carrying `CorpseComponent` (`energy = corpseEnergy`) and logs `ledger.recordCorpseConversion(corpseEnergy)`.

## Decomposition (`src/life/decomposition.ts`)

`stepDecompositionSystem(world, dt, ledger)` gradually recycles every `CorpseComponent`:

1. Releases `released = min(corpse.energy, corpse.decayRatePerSecond * dt)` into `world.fields.get('soil.nutrients')` at the corpse's world position and logs `ledger.recordDecompositionToSoil(released)`.
2. Emits `corpse.scentRatePerSecond * dt` into `world.fields.get('scent.corpse')` so scavengers can locate carcasses via `olfactory-sensor`.
3. Removes the corpse entity from `World` once `corpse.energy <= 1e-9`.

## Recommended Tick Order

Within a simulation step:

1. Actuators emit action events (e.g. `bite`) and queue `pendingActuatorCost`.
2. `stepInteractionSystem` resolves bites (damage + feeding transfer).
3. `stepAgingSystem` advances age, growth scale, and senescence.
4. `stepMetabolismSystem` deducts upkeep and queues starvation damage.
5. `stepHealthSystem` applies queued damage, computes `recentPainPulse`, and flags dead entities.
6. `stepDeathSystem` converts dead entities into corpses.
7. `stepDecompositionSystem` recycles corpse energy into `soil.nutrients` and `scent.corpse`.
