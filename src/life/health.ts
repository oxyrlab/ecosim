import { assertFiniteNumber, InvalidParameterError } from '@core/index';
import type { World } from '@world/index';
import { HealthComponent, type DeathCause, type HealthData } from './components';

/**
 * Queues damage against a {@link HealthData} component and raises its normalized `recentPainPulse`
 * for internal pain sensors.
 *
 * @param health - Target health component.
 * @param amount - Non-negative finite damage points (`HP`).
 * @param cause - Cause recorded if this damage proves lethal (default `'damage'`).
 */
export function applyDamage(
  health: HealthData,
  amount: number,
  cause: DeathCause = 'damage',
): void {
  assertFiniteNumber('amount', amount, 'applyDamage');
  if (amount < 0) {
    throw new InvalidParameterError('amount', amount, 'a finite number >= 0', 'applyDamage');
  }
  if (amount === 0 || health.dead) return;
  health.pendingDamage += amount;
  const pulse = Math.min(1, amount / health.max);
  if (pulse > health.recentPainPulse) {
    health.recentPainPulse = pulse;
  }
  if (health.current - health.pendingDamage <= 0 && health.deathCause === 'none') {
    health.deathCause = cause;
  }
}

/**
 * Resolves queued `pendingDamage` for every entity with a {@link HealthComponent}, clamps
 * `current >= 0`, marks entities at `0` health as `dead`, and clears the previous tick's
 * `recentPainPulse` when no new damage arrived.
 */
export function stepHealthSystem(world: World, dt: number): void {
  assertFiniteNumber('dt', dt, 'stepHealthSystem');
  if (dt < 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number >= 0', 'stepHealthSystem');
  }

  const entities = world.ecs.query(HealthComponent);
  for (const entity of entities) {
    const health = world.ecs.requireComponent(entity, HealthComponent);
    if (health.dead) {
      health.pendingDamage = 0;
      health.recentPainPulse = 0;
      continue;
    }

    if (health.pendingDamage > 0) {
      const applied = health.pendingDamage;
      health.pendingDamage = 0;
      health.current = Math.max(0, health.current - applied);
      const pulse = Math.min(1, applied / health.max);
      if (pulse > health.recentPainPulse) {
        health.recentPainPulse = pulse;
      }
      if (health.current <= 0) {
        health.dead = true;
        if (health.deathCause === 'none') {
          health.deathCause = 'damage';
        }
      }
    } else {
      health.recentPainPulse = 0;
    }
  }
}
