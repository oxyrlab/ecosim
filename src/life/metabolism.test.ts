import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import { EnergyComponent, HealthComponent, LifecycleComponent } from './components';
import { computeWorldEnergy, EnergyLedger } from './energy-ledger';
import { stepMetabolismSystem } from './metabolism';

describe('metabolism system', () => {
  it('deducts basal, brain, and actuator energy in exact balance with EnergyLedger and triggers starvation', () => {
    const world = new World(
      { seed: 1, widthMeters: 10, heightMeters: 10, gridCols: 5, gridRows: 5 },
      createMockPhysicsAdapter(),
    );
    const ledger = new EnergyLedger();

    const e = world.spawnSimpleBody({ position: { x: 2, y: 2 }, radius: 0.3 });
    world.ecs.addComponent(e, EnergyComponent, {
      current: 10,
      max: 100,
      massKg: 2,
      basalRatePerKgPerSecond: 1, // 2 EU/s at efficiency 1, 4 EU/s at efficiency 0.5
      brainUpkeepPerSecond: 0.5,
      pendingActuatorCost: 1.5,
      starvationDamagePerSecond: 10,
      structuralEnergy: 5,
    });
    world.ecs.addComponent(e, LifecycleComponent, {
      ageSeconds: 90,
      maxAgeSeconds: 100,
      maturityAgeSeconds: 20,
      juvenileScale: 0.5,
      adultScale: 1,
      senescenceStartFraction: 0.7,
      minSenescenceEfficiency: 0.5,
      currentScale: 1,
      efficiency: 0.5,
    });
    world.ecs.addComponent(e, HealthComponent, {
      current: 20,
      max: 20,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: false,
      deathCause: 'none',
      energyPerDamage: 1,
    });

    ledger.recordInitialSpawn(computeWorldEnergy(world));

    // Step 1 second: basal = 4, brain = 0.5, actuator = 1.5 -> total 6 EU spent, 4 left
    stepMetabolismSystem(world, 1, ledger);
    expect(world.ecs.requireComponent(e, EnergyComponent).current).toBeCloseTo(4);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // Step 2 more seconds: exhausts remaining 4 EU and applies starvation damage
    stepMetabolismSystem(world, 2, ledger);
    expect(world.ecs.requireComponent(e, EnergyComponent).current).toBe(0);
    expect(world.ecs.requireComponent(e, HealthComponent).pendingDamage).toBeCloseTo(20);
    expect(world.ecs.requireComponent(e, HealthComponent).deathCause).toBe('starvation');
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    expect(() => stepMetabolismSystem(world, -0.1)).toThrow(InvalidParameterError);

    // Entity without LifecycleComponent, zero brain/actuator upkeep, non-lethal starvation, no ledger
    const e2 = world.spawnSimpleBody({ position: { x: 4, y: 4 }, radius: 0.2 });
    world.ecs.addComponent(e2, EnergyComponent, {
      current: 0,
      max: 10,
      massKg: 1,
      basalRatePerKgPerSecond: 1,
      brainUpkeepPerSecond: 0,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 2,
      structuralEnergy: 0,
    });
    world.ecs.addComponent(e2, HealthComponent, {
      current: 20,
      max: 20,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: false,
      deathCause: 'none',
      energyPerDamage: 1,
    });
    stepMetabolismSystem(world, 0.5);
    expect(world.ecs.requireComponent(e2, HealthComponent).pendingDamage).toBeCloseTo(1);
    expect(world.ecs.requireComponent(e2, HealthComponent).deathCause).toBe('none');

    world.free();
  });
});
