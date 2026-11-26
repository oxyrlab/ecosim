# Metabolism & Energy Conservation

EcoSim models energy explicitly in Energy Units (`EU`) using an auditable closed accounting model so ecosystems neither create free energy nor silently leak mass/energy.

## Components (`src/life/components.ts`)

- **`EnergyComponent` (`EnergyData`)**:
  - `current`, `max` (`EU`): usable metabolic reserve (`0 <= current <= max`).
  - `structuralEnergy` (`EU`): energy locked inside body biomass, released into a `corpse` upon death.
  - `massKg`, `basalRatePerKgPerSecond`: basal metabolic upkeep scales with body mass.
  - `brainUpkeepPerSecond`: continuous neural upkeep cost.
  - `pendingActuatorCost`: physical work energy queued by actuators during the current tick.
  - `starvationDamagePerSecond`: health damage rate (`HP / s`) applied once `current === 0` and upkeep cannot be paid.
- **`DietComponent` (`DietData`)**:
  - `assimilationEfficiency` (`(0, 1]`): fraction of ingested energy kept by the consumer; the remainder `(1 - efficiency)` is dissipated as metabolic waste heat.
  - `edibleTags`: entity tags the consumer can bite/feed upon (e.g. `['plant', 'fruit']` or `['prey', 'corpse']`).

## Metabolic Step (`stepMetabolismSystem`)

Every tick (`dt` seconds), for each entity with `EnergyComponent`:

1. Read metabolic efficiency `η` from `LifecycleComponent` (defaults to `1.0` when absent).
2. Compute wanted upkeep:
   - `basalWanted = (massKg * basalRatePerKgPerSecond * dt) / η`
   - `brainWanted = brainUpkeepPerSecond * dt`
   - `actuatorWanted = max(0, pendingActuatorCost)` (then reset `pendingActuatorCost = 0`)
3. Deduct sequentially from `energy.current`, clamping each payment to available energy so the ledger records exact dissipated heat (`basalMetabolism`, `brainUpkeep`, `actuatorWork`).
4. If `energy.current` hits zero while `totalWanted > totalPaid`, queue starvation damage (`starvationDamagePerSecond * dt`) into `HealthComponent.pendingDamage`.

## Feeding & Predation (`stepInteractionSystem`)

Bite actuator action events (`kind: 'bite'`) are resolved against nearby entities carrying at least one matching tag in the attacker's `DietComponent.edibleTags`:

- **Living targets (`HealthComponent`)**: apply bite damage via `applyDamage`, extract up to `actualDamage * energyPerDamage` from the target's `EnergyComponent`, assimilate `assimilationEfficiency * taken` into the attacker (capped by `energy.max`), and log the unassimilated remainder plus any overflow as `feedingWaste` in `EnergyLedger`.
- **Corpse targets (`CorpseComponent`)**: scavenge directly from `corpse.energy` using the same assimilation split.

## Energy Conservation (`EnergyLedger`)

`EnergyLedger` (`src/life/energy-ledger.ts`) tracks:

- **Inflows**: `initialSpawn`, `lightInput` (photosynthesis in Phase 4+).
- **Dissipated outflows**: `basalMetabolism`, `actuatorWork`, `brainUpkeep`, `feedingWaste`, `reproductionCost`.
- **Internal transfers** (for inspection/telemetry): `feedingTransfer`, `corpseConversion`, `decompositionToSoil`, `reproductionTransfer`.

`computeWorldEnergy(world)` sums:

```
Σ (living energy.current + energy.structuralEnergy)
+ Σ (corpse.energy)
+ soil.nutrients.totalMass() * nutrientEnergyPerUnit
```

`ledger.audit(computeWorldEnergy(world), tolerance)` verifies:

```
measuredWorldEnergy ≈ (initialSpawn + lightInput) - totalOutflow
```

## Proprioceptive Bridge

`energy-sensor` (`src/body/sensors/energy-sensor.ts`) reads `ctx.bodyState.energyRatio` (`current / max`) and publishes `level` and `deficit = 1 - level` onto the creature's `SignalBus`, closing the loop between metabolism and hunger/foraging brain modules.
