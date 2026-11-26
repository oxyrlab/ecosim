import { describe, expect, it } from 'vitest';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import { CorpseComponent, DietComponent, EnergyComponent, HealthComponent } from './components';
import { computeWorldEnergy, EnergyLedger } from './energy-ledger';
import { stepHealthSystem } from './health';
import { stepInteractionSystem } from './interaction';

describe('interaction system (bite & feeding)', () => {
  it('deals bite damage to prey, transfers assimilated energy, and balances EnergyLedger', () => {
    const world = new World(
      { seed: 1, widthMeters: 20, heightMeters: 20, gridCols: 10, gridRows: 10 },
      createMockPhysicsAdapter(),
    );
    const ledger = new EnergyLedger();

    const predator = world.spawnSimpleBody({
      position: { x: 5, y: 5 },
      radius: 0.4,
      tags: ['predator'],
    });
    world.ecs.addComponent(predator, EnergyComponent, {
      current: 50,
      max: 100,
      massKg: 2,
      basalRatePerKgPerSecond: 0.5,
      brainUpkeepPerSecond: 0.1,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 5,
      structuralEnergy: 10,
    });
    world.ecs.addComponent(predator, DietComponent, {
      assimilationEfficiency: 0.8,
      edibleTags: ['prey', 'corpse'],
    });

    const prey = world.spawnSimpleBody({
      position: { x: 5.5, y: 5 },
      radius: 0.3,
      tags: ['prey'],
    });
    world.ecs.addComponent(prey, EnergyComponent, {
      current: 30,
      max: 50,
      massKg: 1,
      basalRatePerKgPerSecond: 0.3,
      brainUpkeepPerSecond: 0.1,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 5,
      structuralEnergy: 10,
    });
    world.ecs.addComponent(prey, HealthComponent, {
      current: 20,
      max: 20,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: false,
      deathCause: 'none',
      energyPerDamage: 1.5,
    });

    // Out-of-diet plant nearby should be ignored by carnivore
    const plant = world.spawnSimpleBody({
      position: { x: 5.3, y: 5 },
      radius: 0.2,
      tags: ['plant'],
    });
    world.ecs.addComponent(plant, EnergyComponent, {
      current: 20,
      max: 20,
      massKg: 0.5,
      basalRatePerKgPerSecond: 0,
      brainUpkeepPerSecond: 0,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 0,
      structuralEnergy: 0,
    });

    ledger.recordInitialSpawn(computeWorldEnergy(world));

    const results = stepInteractionSystem(
      world,
      [
        {
          kind: 'bite',
          actorEntityId: predator,
          origin: { x: 5.2, y: 5 },
          direction: { x: 1, y: 0 },
          rangeMeters: 0.8,
          damage: 10,
        },
      ],
      ledger,
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.targetEntityId).toBe(prey);
    expect(results[0]?.energyExtracted).toBeCloseTo(15); // 10 dmg * 1.5 EU/dmg
    expect(results[0]?.energyAssimilated).toBeCloseTo(12); // 15 * 0.8
    expect(results[0]?.energyWasted).toBeCloseTo(3);

    stepHealthSystem(world, 1 / 30);
    expect(world.ecs.requireComponent(prey, HealthComponent).current).toBe(10);
    expect(world.ecs.requireComponent(prey, EnergyComponent).current).toBeCloseTo(15);
    expect(world.ecs.requireComponent(predator, EnergyComponent).current).toBeCloseTo(62);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // Also supports feeding directly on a corpse
    const corpse = world.spawnSimpleBody({
      position: { x: 5.4, y: 5.1 },
      radius: 0.25,
      bodyKind: 'fixed',
      tags: ['corpse'],
    });
    world.ecs.addComponent(corpse, CorpseComponent, {
      energy: 12,
      initialEnergy: 12,
      decayRatePerSecond: 1,
      scentRatePerSecond: 1,
      radius: 0.25,
    });
    ledger.recordInitialSpawn(12);

    const corpseEat = stepInteractionSystem(
      world,
      [
        {
          kind: 'bite',
          actorEntityId: predator,
          origin: { x: 5.2, y: 5.1 },
          direction: { x: 1, y: 0 },
          rangeMeters: 0.5,
          damage: 5,
        },
      ],
      ledger,
    );
    expect(corpseEat[0]?.targetEntityId).toBe(corpse);
    expect(world.ecs.requireComponent(corpse, CorpseComponent).energy).toBeCloseTo(7);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    world.free();
  });

  it('handles edge cases: dead actors, omnivore defaults, energy-only plants, behind/out-of-range targets, and full energy cap', () => {
    const world = new World(
      { seed: 2, widthMeters: 20, heightMeters: 20, gridCols: 10, gridRows: 10 },
      createMockPhysicsAdapter(),
    );

    // Dead/removed actor produces no resolution
    const ghost = world.spawnSimpleBody({ position: { x: 1, y: 1 }, radius: 0.2 });
    world.removeEntity(ghost);
    expect(
      stepInteractionSystem(world, [
        {
          kind: 'bite',
          actorEntityId: ghost,
          origin: { x: 1, y: 1 },
          direction: { x: 1, y: 0 },
          rangeMeters: 1,
          damage: 5,
        },
      ]),
    ).toEqual([]);

    // Actor with no DietComponent (default assimilation, accepts any edible entity) and full energy
    const omnivore = world.spawnSimpleBody({ position: { x: 5, y: 5 }, radius: 0.3 });
    world.ecs.addComponent(omnivore, EnergyComponent, {
      current: 100,
      max: 100,
      massKg: 1,
      basalRatePerKgPerSecond: 0,
      brainUpkeepPerSecond: 0,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 0,
      structuralEnergy: 0,
    });

    // Rock (no food components) + target behind mouth + target out of range
    world.spawnSimpleBody({ position: { x: 5.2, y: 5 }, radius: 0.1 });
    const behind = world.spawnSimpleBody({ position: { x: 4.2, y: 5 }, radius: 0.1 });
    world.ecs.addComponent(behind, EnergyComponent, {
      current: 10,
      max: 10,
      massKg: 1,
      basalRatePerKgPerSecond: 0,
      brainUpkeepPerSecond: 0,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 0,
      structuralEnergy: 0,
    });
    const far = world.spawnSimpleBody({ position: { x: 9, y: 5 }, radius: 0.1 });
    world.ecs.addComponent(far, EnergyComponent, {
      current: 10,
      max: 10,
      massKg: 1,
      basalRatePerKgPerSecond: 0,
      brainUpkeepPerSecond: 0,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 0,
      structuralEnergy: 0,
    });

    // No valid food in front yet
    expect(
      stepInteractionSystem(world, [
        {
          kind: 'bite',
          actorEntityId: omnivore,
          origin: { x: 5, y: 5 },
          direction: { x: 1, y: 0 },
          rangeMeters: 0.9,
          damage: 6,
        },
      ]),
    ).toEqual([]);

    // Energy-only plant (no HealthComponent) in front of omnivore
    const energyPlant = world.spawnSimpleBody({ position: { x: 5.4, y: 5 }, radius: 0.2 });
    world.ecs.addComponent(energyPlant, EnergyComponent, {
      current: 20,
      max: 20,
      massKg: 0.5,
      basalRatePerKgPerSecond: 0,
      brainUpkeepPerSecond: 0,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 0,
      structuralEnergy: 0,
    });

    const plantBite = stepInteractionSystem(world, [
      {
        kind: 'bite',
        actorEntityId: omnivore,
        origin: { x: 5, y: 5 },
        direction: { x: 1, y: 0 },
        rangeMeters: 0.8,
        damage: 6,
      },
    ]);
    expect(plantBite).toHaveLength(1);
    expect(plantBite[0]?.targetEntityId).toBe(energyPlant);
    expect(plantBite[0]?.energyExtracted).toBeCloseTo(6);
    // Omnivore already at max energy -> 0 assimilated, 6 wasted
    expect(plantBite[0]?.energyAssimilated).toBe(0);
    expect(plantBite[0]?.energyWasted).toBeCloseTo(6);

    // Diet requiring tags ignores untagged entities
    const picky = world.spawnSimpleBody({ position: { x: 5, y: 5 }, radius: 0.2 });
    world.ecs.addComponent(picky, DietComponent, {
      assimilationEfficiency: 0.5,
      edibleTags: ['fruit'],
    });
    expect(
      stepInteractionSystem(world, [
        {
          kind: 'bite',
          actorEntityId: picky,
          origin: { x: 5, y: 5 },
          direction: { x: 1, y: 0 },
          rangeMeters: 1,
          damage: 5,
        },
      ]),
    ).toEqual([]);

    // Health-only target (no EnergyComponent) + closer candidate selection
    const healthOnlyFar = world.spawnSimpleBody({
      position: { x: 5.7, y: 5 },
      radius: 0.1,
      tags: ['fruit'],
    });
    world.ecs.addComponent(healthOnlyFar, HealthComponent, {
      current: 10,
      max: 10,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: false,
      deathCause: 'none',
      energyPerDamage: 1,
    });
    const healthOnlyNear = world.spawnSimpleBody({
      position: { x: 5.3, y: 5 },
      radius: 0.1,
      tags: ['fruit'],
    });
    world.ecs.addComponent(healthOnlyNear, HealthComponent, {
      current: 10,
      max: 10,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: false,
      deathCause: 'none',
      energyPerDamage: 1,
    });
    const pickRes = stepInteractionSystem(world, [
      {
        kind: 'bite',
        actorEntityId: picky,
        origin: { x: 5, y: 5 },
        direction: { x: 1, y: 0 },
        rangeMeters: 1,
        damage: 4,
      },
    ]);
    expect(pickRes).toHaveLength(1);
    expect(pickRes[0]?.targetEntityId).toBe(healthOnlyNear);
    expect(pickRes[0]?.damageDealt).toBe(4);
    expect(pickRes[0]?.energyExtracted).toBe(0);

    world.free();
  });
});
