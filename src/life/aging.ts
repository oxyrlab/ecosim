import { assertFiniteNumber, InvalidParameterError } from '@core/index';
import type { World } from '@world/index';
import { HealthComponent, LifecycleComponent, type LifecycleData } from './components';

/**
 * Computes the body growth scale multiplier `scale(age)` for a lifecycle state:
 * grows linearly from `juvenileScale` at age 0 to `adultScale` at `maturityAgeSeconds`.
 */
export function computeGrowthScale(lifecycle: LifecycleData): number {
  if (lifecycle.maturityAgeSeconds <= 0) {
    return lifecycle.adultScale;
  }
  const t = Math.max(0, Math.min(1, lifecycle.ageSeconds / lifecycle.maturityAgeSeconds));
  return lifecycle.juvenileScale + (lifecycle.adultScale - lifecycle.juvenileScale) * t;
}

/**
 * Computes metabolic efficiency in `(0, 1]` as a function of age:
 * remains `1.0` until `senescenceStartFraction * maxAgeSeconds`, then declines linearly to
 * `minSenescenceEfficiency` at `maxAgeSeconds` (Section 5.8).
 */
export function computeMetabolicEfficiency(lifecycle: LifecycleData): number {
  const startAge = lifecycle.senescenceStartFraction * lifecycle.maxAgeSeconds;
  if (lifecycle.ageSeconds <= startAge || lifecycle.maxAgeSeconds <= startAge) {
    return 1;
  }
  const span = lifecycle.maxAgeSeconds - startAge;
  const t = Math.max(0, Math.min(1, (lifecycle.ageSeconds - startAge) / span));
  return 1 - (1 - lifecycle.minSenescenceEfficiency) * t;
}

/**
 * Advances age, updates growth scale and metabolic efficiency for every entity with a
 * {@link LifecycleComponent}, and marks entities reaching `maxAgeSeconds` as dead (`'aging'`).
 */
export function stepAgingSystem(world: World, dt: number): void {
  assertFiniteNumber('dt', dt, 'stepAgingSystem');
  if (dt < 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number >= 0', 'stepAgingSystem');
  }

  const entities = world.ecs.query(LifecycleComponent);
  for (const entity of entities) {
    const lifecycle = world.ecs.requireComponent(entity, LifecycleComponent);
    lifecycle.ageSeconds += dt;
    lifecycle.currentScale = computeGrowthScale(lifecycle);
    lifecycle.efficiency = computeMetabolicEfficiency(lifecycle);

    if (lifecycle.ageSeconds >= lifecycle.maxAgeSeconds) {
      const health = world.ecs.getComponent(entity, HealthComponent);
      if (health !== undefined && !health.dead) {
        health.dead = true;
        health.deathCause = 'aging';
      }
    }
  }
}
