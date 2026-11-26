import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import { CorpseComponent } from './components';
import { stepDecompositionSystem } from './decomposition';
import { computeWorldEnergy, EnergyLedger } from './energy-ledger';

describe('decomposition system', () => {
  it('releases corpse energy into soil.nutrients, emits scent.corpse, and despawns when exhausted', () => {
    const world = new World(
      { seed: 1, widthMeters: 10, heightMeters: 10, gridCols: 5, gridRows: 5 },
      createMockPhysicsAdapter(),
    );
    const ledger = new EnergyLedger();

    const corpse = world.spawnSimpleBody({
      position: { x: 5, y: 5 },
      radius: 0.3,
      bodyKind: 'fixed',
      tags: ['corpse'],
    });
    world.ecs.addComponent(corpse, CorpseComponent, {
      energy: 10,
      initialEnergy: 10,
      decayRatePerSecond: 4,
      scentRatePerSecond: 2,
      radius: 0.3,
    });
    ledger.recordInitialSpawn(computeWorldEnergy(world));

    stepDecompositionSystem(world, 1, ledger);
    expect(world.ecs.requireComponent(corpse, CorpseComponent).energy).toBeCloseTo(6);
    expect(world.fields.get('soil.nutrients').totalMass()).toBeCloseTo(4);
    expect(world.fields.get('scent.corpse').totalMass()).toBeCloseTo(2);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // Finish decomposition
    stepDecompositionSystem(world, 2, ledger);
    expect(world.ecs.isAlive(corpse)).toBe(false);
    expect(world.fields.get('soil.nutrients').totalMass()).toBeCloseTo(10);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    expect(() => stepDecompositionSystem(world, -1)).toThrow(InvalidParameterError);
    expect(() => stepDecompositionSystem(world, 1, ledger, 0)).toThrow(InvalidParameterError);

    // Zero-energy / zero-scent corpse with dt = 0 is cleaned up without adding soil mass or scent
    const emptyCorpse = world.spawnSimpleBody({
      position: { x: 2, y: 2 },
      radius: 0.2,
      bodyKind: 'fixed',
      tags: ['corpse'],
    });
    world.ecs.addComponent(emptyCorpse, CorpseComponent, {
      energy: 0,
      initialEnergy: 1,
      decayRatePerSecond: 1,
      scentRatePerSecond: 0,
      radius: 0.2,
    });
    stepDecompositionSystem(world, 0);
    expect(world.ecs.isAlive(emptyCorpse)).toBe(false);

    world.free();
  });
});
