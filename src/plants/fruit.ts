import { assertFiniteNumber, clamp, InvalidParameterError, type EntityId } from '@core/index';
import {
  EnergyComponent,
  HealthComponent,
  type BiteResolution,
  type EnergyLedger,
} from '@life/index';
import { TransformComponent, type World } from '@world/index';
import { FruitComponent, PlantComponent } from './components';
import { spawnFruit, spawnPlant } from './spawn';

/**
 * Summary of fruit spawns, eaten-seed transfers, and natural fruit expirations in one tick.
 */
export interface FruitStepResult {
  readonly spawnedFruits: readonly EntityId[];
  readonly ingestedSeeds: readonly EntityId[];
  readonly droppedSeeds: readonly EntityId[];
  readonly rottedFruits: readonly EntityId[];
}

/**
 * Records which animal bit/ate each {@link FruitComponent} from `stepInteractionSystem` outputs
 * so `stepFruitSystem` can hand off the fruit's internal seed to that eater for dispersal.
 */
export function recordFruitBites(world: World, resolutions: readonly BiteResolution[]): void {
  for (const res of resolutions) {
    if (res.energyExtracted <= 0) continue;
    const fruit = world.ecs.getComponent(res.targetEntityId, FruitComponent);
    if (fruit !== undefined) {
      fruit.eatenBy = res.actorEntityId;
    }
  }
}

/**
 * Handles fruit production by `fruiting` plants, fruit scent emission, eaten-fruit seed handoff
 * into carrier animals (endozoochory), and expired uneaten fruit germination/decay (Section 5.9).
 *
 * Every energy movement is strictly conserved against `EnergyLedger` and `computeWorldEnergy`.
 */
export function stepFruitSystem(
  world: World,
  dt: number,
  ledger?: EnergyLedger,
  nutrientEnergyPerUnit = 1,
): FruitStepResult {
  assertFiniteNumber('dt', dt, 'stepFruitSystem');
  if (dt < 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number >= 0', 'stepFruitSystem');
  }
  if (!Number.isFinite(nutrientEnergyPerUnit) || nutrientEnergyPerUnit <= 0) {
    throw new InvalidParameterError(
      'nutrientEnergyPerUnit',
      nutrientEnergyPerUnit,
      'a finite number > 0',
      'stepFruitSystem',
    );
  }
  if (dt === 0) {
    return { spawnedFruits: [], ingestedSeeds: [], droppedSeeds: [], rottedFruits: [] };
  }

  const spawnedFruits: EntityId[] = [];
  const ingestedSeeds: EntityId[] = [];
  const droppedSeeds: EntityId[] = [];
  const rottedFruits: EntityId[] = [];

  const nutrientField = world.fields.get('soil.nutrients');

  // 1. Spawn fruits from fruiting plants with sufficient surplus energy
  for (const entity of world.ecs.query(PlantComponent, EnergyComponent, TransformComponent)) {
    const plant = world.ecs.requireComponent(entity, PlantComponent);
    if (plant.stage !== 'fruiting' || plant.carriedBy !== null) continue;
    const health = world.ecs.getComponent(entity, HealthComponent);
    if (health !== undefined && health.dead) continue;

    const spec = plant.spec;
    if (plant.fruitsInCurrentCycle >= spec.maxFruitsPerCycle) continue;

    const energy = world.ecs.requireComponent(entity, EnergyComponent);
    const totalFruitCost = spec.fruitFleshEnergy + spec.seedEnergy;
    const minReserve = Math.max(1, spec.seedEnergy * 0.5);
    if (energy.current < totalFruitCost + minReserve) continue;

    const transform = world.ecs.requireComponent(entity, TransformComponent);
    const angle = world.rng.next() * Math.PI * 2;
    const dist = plant.currentRadius + spec.fruitRadius + 0.08;
    const fx = clamp(
      transform.x + Math.cos(angle) * dist,
      spec.fruitRadius,
      Math.max(spec.fruitRadius, world.config.widthMeters - spec.fruitRadius),
    );
    const fy = clamp(
      transform.y + Math.sin(angle) * dist,
      spec.fruitRadius,
      Math.max(spec.fruitRadius, world.config.heightMeters - spec.fruitRadius),
    );

    energy.current -= totalFruitCost;
    const fruitId = spawnFruit(
      world,
      spec,
      { x: fx, y: fy },
      spec.fruitFleshEnergy,
      spec.seedEnergy,
    );
    plant.fruitsInCurrentCycle += 1;
    plant.totalFruitsProduced += 1;
    spawnedFruits.push(fruitId);
  }

  // 2. Step existing fruits: emit scent, handle eaten handoff, and expire uneaten fruits
  const fruits = world.ecs.query(FruitComponent, EnergyComponent, TransformComponent);
  for (const entity of fruits) {
    const fruit = world.ecs.requireComponent(entity, FruitComponent);
    const energy = world.ecs.requireComponent(entity, EnergyComponent);
    const transform = world.ecs.requireComponent(entity, TransformComponent);

    const cx = clamp(transform.x, 0, Math.max(0, nutrientField.widthMeters - 1e-4));
    const cy = clamp(transform.y, 0, Math.max(0, nutrientField.heightMeters - 1e-4));

    // Check if the fruit's edible flesh has been consumed
    if (energy.current <= 1e-6) {
      const residualFlesh = Math.max(0, energy.current);
      if (residualFlesh > 0) {
        nutrientField.addAtWorld(cx, cy, residualFlesh / nutrientEnergyPerUnit);
        ledger?.recordDecompositionToSoil(residualFlesh);
      }

      const eater = fruit.eatenBy;
      if (eater !== null && world.ecs.isAlive(eater)) {
        const eaterPos = world.ecs.getComponent(eater, TransformComponent);
        const carrierPos =
          eaterPos !== undefined ? { x: eaterPos.x, y: eaterPos.y } : { x: cx, y: cy };
        const seedId = spawnPlant(world, fruit.spec, carrierPos, {
          stage: 'seed',
          initialEnergy: fruit.seedEnergy,
          structuralEnergy: 0,
          carriedBy: eater,
          dispersalRemainingSeconds: fruit.dispersalDelaySeconds,
          lastCarrierPos: carrierPos,
        });
        ingestedSeeds.push(seedId);
      } else {
        const seedId = spawnPlant(
          world,
          fruit.spec,
          { x: cx, y: cy },
          { stage: 'seed', initialEnergy: fruit.seedEnergy, structuralEnergy: 0 },
        );
        droppedSeeds.push(seedId);
      }

      world.removeEntity(entity);
      continue;
    }

    // Emit fruit scent
    if (fruit.scentRatePerSecond > 0 && world.fields.has(fruit.spec.scentField)) {
      world.fields.get(fruit.spec.scentField).addAtWorld(cx, cy, fruit.scentRatePerSecond * dt);
    }

    // Age and check natural expiration
    fruit.ageSeconds += dt;
    if (fruit.ageSeconds >= fruit.maxAgeSeconds) {
      const remainingFlesh = Math.max(0, energy.current);
      if (world.rng.next() < fruit.germinationProbability) {
        if (remainingFlesh > 0) {
          nutrientField.addAtWorld(cx, cy, remainingFlesh / nutrientEnergyPerUnit);
          ledger?.recordDecompositionToSoil(remainingFlesh);
        }
        const seedId = spawnPlant(
          world,
          fruit.spec,
          { x: cx, y: cy },
          { stage: 'seed', initialEnergy: fruit.seedEnergy, structuralEnergy: 0 },
        );
        droppedSeeds.push(seedId);
      } else {
        const totalDecay = remainingFlesh + fruit.seedEnergy;
        nutrientField.addAtWorld(cx, cy, totalDecay / nutrientEnergyPerUnit);
        ledger?.recordDecompositionToSoil(totalDecay);
        rottedFruits.push(entity);
      }
      world.removeEntity(entity);
    }
  }

  return { spawnedFruits, ingestedSeeds, droppedSeeds, rottedFruits };
}
