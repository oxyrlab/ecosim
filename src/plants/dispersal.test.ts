import { describe, expect, it } from 'vitest';
import { InvalidParameterError, type EntityId } from '@core/index';
import { computeWorldEnergy, EnergyLedger } from '@life/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { PhysicsBodyComponent, TransformComponent, World } from '@world/index';
import { parsePlantSpeciesSpec, PlantComponent } from './components';
import { stepSeedDispersalSystem } from './dispersal';
import { spawnPlant } from './spawn';

describe('seed dispersal system', () => {
  it('tracks carrier movement, excretes rooted seeds after delay, and drops seeds if carrier dies', () => {
    const world = new World(
      { seed: 11, widthMeters: 30, heightMeters: 30, gridCols: 15, gridRows: 15 },
      createMockPhysicsAdapter(),
    );
    const ledger = new EnergyLedger();
    const spec = parsePlantSpeciesSpec({ speciesId: 'berry-bush', seedEnergy: 4 });

    const carrier = world.spawnSimpleBody({ position: { x: 5, y: 5 }, radius: 0.3 });
    const carried = spawnPlant(
      world,
      spec,
      { x: 5, y: 5 },
      { stage: 'seed', carriedBy: carrier, dispersalRemainingSeconds: 3 },
    );
    ledger.recordInitialSpawn(computeWorldEnergy(world));

    expect(stepSeedDispersalSystem(world, 0)).toEqual([]);

    // Carrier moves to (18, 12) while digesting seed
    world.physics.setBodyTransform(
      world.ecs.requireComponent(carrier, PhysicsBodyComponent).bodyHandle,
      { x: 18, y: 12 },
      0,
    );
    world.syncFromPhysics();
    expect(stepSeedDispersalSystem(world, 1.5)).toEqual([]);
    expect(world.ecs.isAlive(carried)).toBe(true);

    // Timer expires -> deposited near (18, 12) with physics body, exact energy preserved
    const deposited = stepSeedDispersalSystem(world, 2);
    expect(deposited).toHaveLength(1);
    expect(world.ecs.isAlive(carried)).toBe(false);
    const seedId = deposited[0] as EntityId;
    const pos = world.ecs.requireComponent(seedId, TransformComponent);
    expect(Math.hypot(pos.x - 18, pos.y - 12)).toBeLessThan(0.5);
    expect(world.ecs.requireComponent(seedId, PlantComponent).carriedBy).toBeNull();
    expect(world.ecs.hasComponent(seedId, PhysicsBodyComponent)).toBe(true);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // Carrier dying early immediately drops seed at last known position
    const carried2 = spawnPlant(
      world,
      spec,
      { x: 18, y: 12 },
      { stage: 'seed', carriedBy: carrier, dispersalRemainingSeconds: 10 },
    );
    ledger.recordInitialSpawn(spec.seedEnergy);
    world.removeEntity(carrier);
    const emergencyDrop = stepSeedDispersalSystem(world, 0.1);
    expect(emergencyDrop).toHaveLength(1);
    expect(world.ecs.isAlive(carried2)).toBe(false);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    expect(() => stepSeedDispersalSystem(world, -1)).toThrow(InvalidParameterError);
    world.free();
  });
});
