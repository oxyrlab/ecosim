import { assertFiniteNumber, InvalidParameterError, type EntityId } from '@core/index';
import { HealthComponent } from '@life/index';
import { TransformComponent, type World } from '@world/index';
import { PlantComponent } from './components';

/**
 * Resolves simple distance-based pollination for flowering plants (Section 5.9).
 *
 * When a `flowering`, unpollinated plant finds another `flowering` plant of the same `speciesId`
 * within `spec.pollinationRadiusMeters`, it is fertilized with per-second probability
 * `spec.pollinationProbabilityPerSecond` (converted to `1 - (1 - p)^dt`). Isolated plants may
 * optionally self-pollinate via `spec.selfPollinationProbabilityPerSecond`.
 *
 * @returns Array of entity IDs pollinated during this step.
 */
export function stepPollinationSystem(world: World, dt: number): EntityId[] {
  assertFiniteNumber('dt', dt, 'stepPollinationSystem');
  if (dt < 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number >= 0', 'stepPollinationSystem');
  }
  if (dt === 0) return [];

  const pollinated: EntityId[] = [];

  for (const entity of world.ecs.query(PlantComponent, TransformComponent)) {
    const plant = world.ecs.requireComponent(entity, PlantComponent);
    if (plant.stage !== 'flowering' || plant.pollinated || plant.carriedBy !== null) continue;

    const health = world.ecs.getComponent(entity, HealthComponent);
    if (health !== undefined && health.dead) continue;

    const transform = world.ecs.requireComponent(entity, TransformComponent);
    const spec = plant.spec;

    const nearby = world.spatialHash.queryRadius(
      transform.x,
      transform.y,
      spec.pollinationRadiusMeters,
    );

    let hasPartner = false;
    for (const candidate of nearby) {
      if (candidate === entity || !world.ecs.isAlive(candidate)) continue;
      const other = world.ecs.getComponent(candidate, PlantComponent);
      if (other === undefined || other.speciesId !== plant.speciesId) continue;
      if (other.stage !== 'flowering' && other.stage !== 'fruiting') continue;

      const otherPos = world.ecs.getComponent(candidate, TransformComponent);
      if (otherPos === undefined) continue;
      const dist = Math.hypot(otherPos.x - transform.x, otherPos.y - transform.y);
      if (dist <= spec.pollinationRadiusMeters) {
        hasPartner = true;
        break;
      }
    }

    const ratePerSec = hasPartner
      ? spec.pollinationProbabilityPerSecond
      : spec.selfPollinationProbabilityPerSecond;
    if (ratePerSec <= 0) continue;

    const stepProb = ratePerSec >= 1 ? 1 : 1 - Math.pow(1 - ratePerSec, dt);
    if (world.rng.next() < stepProb) {
      plant.pollinated = true;
      pollinated.push(entity);
    }
  }

  return pollinated;
}
