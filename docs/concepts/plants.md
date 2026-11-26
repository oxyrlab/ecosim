# Plants, Pollination, Fruit & Seed Dispersal

Plants share the same ECS and physics architecture as animals (`kingdom: 'plant'`, `COLLISION_GROUP.PLANT`), with **no brain, spine, or SignalBus** (Section 5.9).

## Components & Species Spec (`src/plants/components.ts`)

- **`PlantSpeciesSpec`** (validated by `plantSpeciesSpecSchema` via `parsePlantSpeciesSpec`): defines photosynthesis rate, `nutrientFraction`, stage age/energy thresholds, organ sizes (`maxStemLength`, `maxLeafArea`, `maxFlowers`), `pollinationRadiusMeters`, fruit parameters, and dispersal delay.
- **`PlantComponent` (`PlantData`)**: stores `kingdom: 'plant'`, `speciesId`, `stage`, `organs` (`stemLength`, `leafArea`, `flowerCount`), `pollinated`, `currentRadius`, and endozoochorous carrier tracking (`carriedBy`, `dispersalRemainingSeconds`, `lastCarrierPos`).
- **`FruitComponent` (`FruitData`)**: independent entity (`tags: ['fruit', speciesId]`, `COLLISION_GROUP.FRUIT`) carrying edible flesh energy in `EnergyComponent.current` and internal seed energy in `EnergyComponent.structuralEnergy`.

## Lifecycle State Machine (`src/plants/lifecycle.ts`)

```
seed → sprout → mature → flowering → fruiting → (mature | senescence) → death
```

- **Germination (`seed → sprout`)**: requires `germinationDelaySeconds`, minimum `light` and `soil.moisture`, and neighbor count within `crowdingRadiusMeters <= maxNeighborsToGerminate`.
- **Growth & Colliders**: `stemLength`, `leafArea`, and `currentRadius` grow from `seedRadius` to `adultRadius`. Whenever `currentRadius` changes beyond `0.01 m`, the old circle collider is removed and replaced via `PhysicsAdapter` (zero handle leaks) and `SpatialHash` is updated.
- **Senescence & Death**: reaching `senescenceAgeSeconds` stops photosynthesis and shrinks leaves; reaching `maxAgeSeconds` marks `HealthComponent.dead = true` so Phase 3's `stepDeathSystem` and `stepDecompositionSystem` recycle the plant's energy back into `soil.nutrients`.

## Photosynthesis & Energy Conservation (`src/plants/photosynthesis.ts`)

Photosynthesizing stages (`sprout`, `mature`, `flowering`, `fruiting`) compute potential gain from `photosynthesisRatePerArea * leafArea * light * soil.moisture * dt`:

- A fraction `nutrientFraction` of the gain is withdrawn from the local `soil.nutrients` cell (internal transfer; growth stops if soil nutrients are exhausted).
- The remaining `(1 - nutrientFraction)` is solar inflow recorded via `ledger.recordLightInput(solarInflowEu)`.
- Plants also emit scent into `spec.scentField` (default `'scent.plant'`).

## Pollination, Fruiting & Seed Dispersal

- **Simple Pollination (`src/plants/pollination.ts`)**: `stepPollinationSystem` queries `SpatialHash` within `pollinationRadiusMeters` for another flowering/fruiting plant of the same `speciesId` and fertilizes with per-second probability `pollinationProbabilityPerSecond` (plus optional `selfPollinationProbabilityPerSecond`).
- **Fruiting (`src/plants/fruit.ts`)**:
  - `stepFruitSystem` spawns fruits from `fruiting` plants by transferring `fruitFleshEnergy + seedEnergy` from `plant.energy.current` into the fruit (zero net energy creation).
  - `recordFruitBites(world, resolutions)` links `stepInteractionSystem` bite events to `FruitComponent.eatenBy`.
  - When a fruit's flesh is consumed, its internal seed is transferred to the eater as a carried `seed` entity (`carriedBy = eater`, holding `EnergyComponent` without a physics body so `computeWorldEnergy` stays balanced).
  - When an uneaten fruit reaches `maxAgeSeconds`, it either drops a rooted seed (with `germinationProbability`) and returns flesh to `soil.nutrients`, or rots completely into `soil.nutrients`.
- **Dispersal (`src/plants/dispersal.ts`)**: `stepSeedDispersalSystem` tracks the carrier animal's position and deposits a rooted `seed` entity at the carrier's location once `dispersalRemainingSeconds <= 0` or the carrier dies.
