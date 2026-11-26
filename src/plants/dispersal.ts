import { assertFiniteNumber, clamp, InvalidParameterError, type EntityId } from '@core/index';
import { EnergyComponent } from '@life/index';
import { TransformComponent, type World } from '@world/index';
import { PlantComponent } from './components';
import { spawnPlant } from './spawn';

/**
 * Advances animal-carried seeds (`PlantComponent.carriedBy !== null`), tracking the carrier
 * animal's position and excreting/depositing seeds as rooted `seed` entities once the dispersal
 * delay expires or the carrier dies (Section 5.9).
 *
 * @returns Newly deposited rooted seed entity IDs.
 */
export function stepSeedDispersalSystem(world: World, dt: number): EntityId[] {
  assertFiniteNumber('dt', dt, 'stepSeedDispersalSystem');
  if (dt < 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number >= 0', 'stepSeedDispersalSystem');
  }
  if (dt === 0) return [];

  const deposited: EntityId[] = [];
  const candidates = world.ecs.query(PlantComponent, EnergyComponent);

  for (const entity of candidates) {
    const plant = world.ecs.requireComponent(entity, PlantComponent);
    if (plant.carriedBy === null) continue;

    const carrierAlive = world.ecs.isAlive(plant.carriedBy);
    if (carrierAlive) {
      const carrierPos = world.ecs.getComponent(plant.carriedBy, TransformComponent);
      if (carrierPos !== undefined) {
        plant.lastCarrierPos = { x: carrierPos.x, y: carrierPos.y };
      }
    }

    plant.dispersalRemainingSeconds -= dt;
    if (!carrierAlive || plant.dispersalRemainingSeconds <= 0) {
      const energy = world.ecs.requireComponent(entity, EnergyComponent);
      const base = plant.lastCarrierPos ?? {
        x: world.config.widthMeters * 0.5,
        y: world.config.heightMeters * 0.5,
      };
      const angle = world.rng.next() * Math.PI * 2;
      const scatter = 0.1 + world.rng.next() * 0.25;
      const r = plant.spec.seedRadius;
      const dropX = clamp(
        base.x + Math.cos(angle) * scatter,
        r,
        Math.max(r, world.config.widthMeters - r),
      );
      const dropY = clamp(
        base.y + Math.sin(angle) * scatter,
        r,
        Math.max(r, world.config.heightMeters - r),
      );

      const newSeed = spawnPlant(
        world,
        plant.spec,
        { x: dropX, y: dropY },
        {
          stage: 'seed',
          initialEnergy: energy.current,
          structuralEnergy: energy.structuralEnergy,
        },
      );
      world.ecs.destroyEntity(entity);
      deposited.push(newSeed);
    }
  }

  return deposited;
}
