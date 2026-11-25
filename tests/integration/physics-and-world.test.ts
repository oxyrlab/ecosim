import { describe, expect, it } from 'vitest';
import { createRapierPhysicsAdapter } from '@physics/index';
import { TransformComponent, World } from '@world/index';

describe('Integration: Rapier physics + World + SpatialHash', () => {
  it('rebounds bodies off boundary walls, updates SpatialHash, and leaks zero WASM handles', async () => {
    const physics = await createRapierPhysicsAdapter();
    const world = new World(
      {
        seed: 2026,
        widthMeters: 10,
        heightMeters: 10,
        gridCols: 10,
        gridRows: 10,
        addBoundaryWalls: true,
      },
      physics,
    );

    const wallCount = physics.getStats().bodyCount;
    expect(wallCount).toBe(4);

    const runner = world.spawnSimpleBody({
      position: { x: 8.5, y: 5 },
      radius: 0.4,
      linearVelocity: { x: 8, y: 0 },
      linearDamping: 0,
    });

    let hitWall = false;
    for (let i = 0; i < 30; i += 1) {
      physics.step(1 / 30);
      const events = physics.drainCollisionEvents();
      if (events.some((e) => e.started)) {
        hitWall = true;
      }
      world.syncFromPhysics();
    }

    expect(hitWall).toBe(true);
    const pose = world.ecs.requireComponent(runner, TransformComponent);
    expect(pose.x).toBeLessThanOrEqual(10);
    expect(pose.x).toBeGreaterThan(0);
    expect(world.spatialHash.queryRadius(pose.x, pose.y, 0.5)).toContain(runner);

    world.removeEntity(runner);
    expect(world.spatialHash.size).toBe(0);
    expect(physics.getStats().bodyCount).toBe(wallCount);

    world.free();
  });
});
