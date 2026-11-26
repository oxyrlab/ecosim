import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import { HealthComponent } from './components';
import { applyDamage, stepHealthSystem } from './health';

describe('health system', () => {
  it('applies queued damage, emits normalized pain pulse, resets pulse when unhurt, and marks dead at 0', () => {
    const world = new World(
      { seed: 1, widthMeters: 10, heightMeters: 10, gridCols: 5, gridRows: 5 },
      createMockPhysicsAdapter(),
    );
    const e = world.spawnSimpleBody({ position: { x: 2, y: 2 }, radius: 0.3 });
    const health = {
      current: 20,
      max: 20,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: false,
      deathCause: 'none' as const,
      energyPerDamage: 1,
    };
    world.ecs.addComponent(e, HealthComponent, health);

    applyDamage(health, 0);
    expect(health.pendingDamage).toBe(0);

    applyDamage(health, 5, 'damage');
    stepHealthSystem(world, 1 / 30);
    expect(health.current).toBe(15);
    expect(health.recentPainPulse).toBeCloseTo(0.25);
    expect(health.dead).toBe(false);

    // Next tick without damage resets pain pulse
    stepHealthSystem(world, 1 / 30);
    expect(health.recentPainPulse).toBe(0);

    // Lethal damage marks dead
    applyDamage(health, 20, 'damage');
    stepHealthSystem(world, 1 / 30);
    expect(health.current).toBe(0);
    expect(health.dead).toBe(true);
    expect(health.deathCause).toBe('damage');

    // Subsequent step on dead entity clears pain pulse and stays dead
    stepHealthSystem(world, 1 / 30);
    expect(health.recentPainPulse).toBe(0);

    // Direct pendingDamage (e.g. without applyDamage) still computes pain pulse and default deathCause
    const e2 = world.spawnSimpleBody({ position: { x: 3, y: 3 }, radius: 0.3 });
    const h2 = {
      current: 10,
      max: 10,
      pendingDamage: 12,
      recentPainPulse: 0,
      dead: false,
      deathCause: 'none' as const,
      energyPerDamage: 1,
    };
    world.ecs.addComponent(e2, HealthComponent, h2);
    stepHealthSystem(world, 1 / 30);
    expect(h2.current).toBe(0);
    expect(h2.recentPainPulse).toBe(1);
    expect(h2.dead).toBe(true);
    expect(h2.deathCause).toBe('damage');

    expect(() => applyDamage(health, -1)).toThrow(InvalidParameterError);
    expect(() => stepHealthSystem(world, -1)).toThrow(InvalidParameterError);
    world.free();
  });
});
