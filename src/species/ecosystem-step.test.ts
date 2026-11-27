import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { computeWorldEnergy, CorpseComponent, EnergyComponent, EnergyLedger } from '@life/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import { computeWorldStateHash, stepEcosystemTick } from './ecosystem-step';
import { spawnSpeciesEntity } from './entity-factory';
import { FOX_BLUEPRINT } from './fox/blueprint';
import { GRASS_BLUEPRINT } from './grass';
import { RABBIT_BLUEPRINT } from './rabbit/blueprint';

describe('ecosystem-step runner and state hash', () => {
  it('advances all subsystems deterministically and balances EnergyLedger', () => {
    const run = (): { hash: number; balanced: boolean } => {
      const world = new World(
        { seed: 17, widthMeters: 24, heightMeters: 24, gridCols: 12, gridRows: 12 },
        createMockPhysicsAdapter(),
      );
      const ledger = new EnergyLedger();
      world.fields.paintField('soil.nutrients', 12, 12, 10, 15, 'add');

      spawnSpeciesEntity(
        world,
        GRASS_BLUEPRINT,
        { x: 12.4, y: 12 },
        { plantOptions: { stage: 'mature' } },
      );
      const rabbit = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 12, y: 12 }, { angle: 0 });
      world.ecs.requireComponent(rabbit, EnergyComponent).current = 15;
      spawnSpeciesEntity(world, FOX_BLUEPRINT, { x: 21, y: 12 }, { angle: Math.PI });
      const corpse = world.spawnSimpleBody({
        position: { x: 6, y: 6 },
        radius: 0.25,
        bodyKind: 'fixed',
        tags: ['corpse'],
      });
      world.ecs.addComponent(corpse, CorpseComponent, {
        energy: 10,
        initialEnergy: 10,
        decayRatePerSecond: 1,
        scentRatePerSecond: 0.5,
        radius: 0.25,
      });
      ledger.recordInitialSpawn(computeWorldEnergy(world));

      for (let i = 0; i < 15; i += 1) {
        stepEcosystemTick(world, 1 / 30, ledger);
      }

      const hash = computeWorldStateHash(world);
      const balanced = ledger.audit(computeWorldEnergy(world), 1e-2).balanced;
      world.free();
      return { hash, balanced };
    };

    const a = run();
    const b = run();
    expect(a.hash).toBe(b.hash);
    expect(a.balanced).toBe(true);

    const w = new World(
      { seed: 1, widthMeters: 10, heightMeters: 10, gridCols: 5, gridRows: 5 },
      createMockPhysicsAdapter(),
    );
    expect(() => stepEcosystemTick(w, 0)).toThrow(InvalidParameterError);
    w.free();
  });
});
