import { describe, expect, it } from 'vitest';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { TagsComponent, World } from '@world/index';
import { CorpseComponent, EnergyComponent, HealthComponent } from './components';
import { stepDeathSystem } from './death';
import { computeWorldEnergy, EnergyLedger } from './energy-ledger';

describe('death system', () => {
  it('converts dead entities into corpses preserving total energy and removes zero-energy entities', () => {
    const world = new World(
      { seed: 1, widthMeters: 10, heightMeters: 10, gridCols: 5, gridRows: 5 },
      createMockPhysicsAdapter(),
    );
    const ledger = new EnergyLedger();

    const rich = world.spawnSimpleBody({ position: { x: 4, y: 4 }, radius: 0.35 });
    world.ecs.addComponent(rich, EnergyComponent, {
      current: 15,
      max: 50,
      massKg: 1,
      basalRatePerKgPerSecond: 0.5,
      brainUpkeepPerSecond: 0,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 5,
      structuralEnergy: 10,
    });
    world.ecs.addComponent(rich, HealthComponent, {
      current: 0,
      max: 20,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: true,
      deathCause: 'damage',
      energyPerDamage: 1,
    });

    const empty = world.spawnSimpleBody({ position: { x: 6, y: 6 }, radius: 0.2 });
    world.ecs.addComponent(empty, HealthComponent, {
      current: 0,
      max: 10,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: true,
      deathCause: 'aging',
      energyPerDamage: 1,
    });

    ledger.recordInitialSpawn(computeWorldEnergy(world));

    const records = stepDeathSystem(world, ledger);
    expect(records).toHaveLength(2);
    expect(world.ecs.isAlive(rich)).toBe(false);
    expect(world.ecs.isAlive(empty)).toBe(false);

    const corpseRecord = records.find((r) => r.deadEntityId === rich);
    expect(corpseRecord?.corpseEntityId).not.toBeNull();
    expect(corpseRecord?.corpseEnergy).toBeCloseTo(25);

    if (corpseRecord?.corpseEntityId !== null && corpseRecord?.corpseEntityId !== undefined) {
      expect(
        world.ecs.requireComponent(corpseRecord.corpseEntityId, CorpseComponent).energy,
      ).toBeCloseTo(25);
      expect(
        world.ecs.requireComponent(corpseRecord.corpseEntityId, TagsComponent).values.has('corpse'),
      ).toBe(true);
    }

    const emptyRecord = records.find((r) => r.deadEntityId === empty);
    expect(emptyRecord?.corpseEntityId).toBeNull();

    // Total energy strictly conserved across death -> corpse conversion
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // Dead ECS-only entity (no Transform/RenderableStub) falls back to origin & default radius
    const bare = world.ecs.createEntity();
    world.ecs.addComponent(bare, HealthComponent, {
      current: 0,
      max: 10,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: true,
      deathCause: 'damage',
      energyPerDamage: 1,
    });
    const bareRecords = stepDeathSystem(world, undefined, {
      defaultCorpseDecayRatePerSecond: 3,
      defaultCorpseScentRatePerSecond: 1,
      corpseColor: 0x555555,
    });
    expect(bareRecords).toHaveLength(1);
    expect(bareRecords[0]?.corpseEntityId).toBeNull();

    world.free();
  });
});
