import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import { computeGrowthScale, computeMetabolicEfficiency, stepAgingSystem } from './aging';
import { HealthComponent, LifecycleComponent, type LifecycleData } from './components';

describe('aging system', () => {
  const makeLifecycle = (overrides: Partial<LifecycleData> = {}): LifecycleData => ({
    ageSeconds: 0,
    maxAgeSeconds: 100,
    maturityAgeSeconds: 20,
    juvenileScale: 0.5,
    adultScale: 1.0,
    senescenceStartFraction: 0.7,
    minSenescenceEfficiency: 0.5,
    currentScale: 0.5,
    efficiency: 1.0,
    ...overrides,
  });

  it('grows from juvenile to adult scale and declines efficiency during senescence', () => {
    expect(computeGrowthScale(makeLifecycle({ ageSeconds: 0 }))).toBeCloseTo(0.5);
    expect(computeGrowthScale(makeLifecycle({ ageSeconds: 10 }))).toBeCloseTo(0.75);
    expect(computeGrowthScale(makeLifecycle({ ageSeconds: 30 }))).toBeCloseTo(1.0);
    expect(computeGrowthScale(makeLifecycle({ maturityAgeSeconds: 0 }))).toBeCloseTo(1.0);

    expect(computeMetabolicEfficiency(makeLifecycle({ ageSeconds: 50 }))).toBe(1);
    expect(computeMetabolicEfficiency(makeLifecycle({ ageSeconds: 85 }))).toBeCloseTo(0.75);
    expect(computeMetabolicEfficiency(makeLifecycle({ ageSeconds: 100 }))).toBeCloseTo(0.5);
  });

  it('advances age and marks entities reaching maxAgeSeconds as dead by aging', () => {
    const world = new World(
      { seed: 1, widthMeters: 10, heightMeters: 10, gridCols: 5, gridRows: 5 },
      createMockPhysicsAdapter(),
    );
    const e = world.spawnSimpleBody({ position: { x: 2, y: 2 }, radius: 0.3 });
    world.ecs.addComponent(e, LifecycleComponent, makeLifecycle({ ageSeconds: 95 }));
    world.ecs.addComponent(e, HealthComponent, {
      current: 50,
      max: 50,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: false,
      deathCause: 'none',
      energyPerDamage: 1,
    });

    stepAgingSystem(world, 3);
    expect(world.ecs.requireComponent(e, HealthComponent).dead).toBe(false);
    expect(world.ecs.requireComponent(e, LifecycleComponent).efficiency).toBeLessThan(0.6);

    stepAgingSystem(world, 3);
    const health = world.ecs.requireComponent(e, HealthComponent);
    expect(health.dead).toBe(true);
    expect(health.deathCause).toBe('aging');

    expect(() => stepAgingSystem(world, -1)).toThrow(InvalidParameterError);
    world.free();
  });
});
