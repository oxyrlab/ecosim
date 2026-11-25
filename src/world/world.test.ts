import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { PhysicsBodyComponent, TransformComponent } from './components';
import { World } from './world';

describe('World', () => {
  it('spawns, syncs from physics, removes entities cleanly, and frees resources', () => {
    const physics = createMockPhysicsAdapter();
    const world = new World(
      {
        seed: 42,
        widthMeters: 20,
        heightMeters: 20,
        gridCols: 10,
        gridRows: 10,
        addBoundaryWalls: true,
      },
      physics,
    );

    expect(physics.getStats().bodyCount).toBe(4); // 4 boundary walls

    const e1 = world.spawnSimpleBody({
      position: { x: 5, y: 5 },
      radius: 0.5,
      linearVelocity: { x: 2, y: 0 },
      tags: ['prey'],
    });
    const bodyComp = world.ecs.requireComponent(e1, PhysicsBodyComponent);
    expect(world.getEntityByBody(bodyComp.bodyHandle)).toBe(e1);
    expect(world.spatialHash.queryRadius(5, 5, 1)).toEqual([e1]);

    physics.step(0.5);
    world.syncFromPhysics();
    expect(world.ecs.requireComponent(e1, TransformComponent).x).toBeGreaterThan(5);

    world.removeEntity(e1);
    world.removeEntity(e1); // idempotent
    expect(world.ecs.isAlive(e1)).toBe(false);
    expect(world.getEntityByBody(bodyComp.bodyHandle)).toBeUndefined();
    expect(world.spatialHash.size).toBe(0);
    expect(physics.getStats().bodyCount).toBe(4); // only boundary walls remain

    world.free();
  });

  it('validates config dimensions and non-square grid cells', () => {
    const adapter = createMockPhysicsAdapter();
    expect(
      () =>
        new World({ seed: 1, widthMeters: 0, heightMeters: 10, gridCols: 5, gridRows: 5 }, adapter),
    ).toThrow(InvalidParameterError);
    expect(
      () =>
        new World({ seed: 1, widthMeters: 10, heightMeters: 0, gridCols: 5, gridRows: 5 }, adapter),
    ).toThrow(InvalidParameterError);
    expect(
      () =>
        new World(
          { seed: 1, widthMeters: 10, heightMeters: 10, gridCols: 0, gridRows: 5 },
          adapter,
        ),
    ).toThrow(InvalidParameterError);
    expect(
      () =>
        new World(
          { seed: 1, widthMeters: 10, heightMeters: 10, gridCols: 5, gridRows: 0 },
          adapter,
        ),
    ).toThrow(InvalidParameterError);
    expect(
      () =>
        new World(
          { seed: 1, widthMeters: 20, heightMeters: 10, gridCols: 5, gridRows: 5 },
          adapter,
        ),
    ).toThrow(InvalidParameterError);

    const validWorld = new World(
      {
        seed: 1,
        widthMeters: 10,
        heightMeters: 10,
        gridCols: 5,
        gridRows: 5,
        addBoundaryWalls: false,
      },
      adapter,
    );
    expect(() => validWorld.spawnSimpleBody({ position: { x: 1, y: 1 }, radius: 0 })).toThrow(
      InvalidParameterError,
    );
    validWorld.free();
  });
});
