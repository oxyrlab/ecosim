import { describe, expect, it } from 'vitest';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import { buildRenderSnapshot, readSnapshotEntity, SNAPSHOT_STRIDE } from './snapshot';

describe('snapshot', () => {
  it('packs and unpacks entity state into a compact Float32Array', () => {
    const world = new World(
      { seed: 1, widthMeters: 30, heightMeters: 20, gridCols: 15, gridRows: 10 },
      createMockPhysicsAdapter(),
    );
    const e1 = world.spawnSimpleBody({
      position: { x: 4.5, y: 6.25 },
      angle: 0.5,
      radius: 0.75,
      kind: 2,
      color: 0xff8800,
    });
    world.tick = 12;
    world.timeSeconds = 0.4;

    const snap = buildRenderSnapshot(world);
    expect(snap.tick).toBe(12);
    expect(snap.timeSeconds).toBeCloseTo(0.4);
    expect(snap.entityCount).toBe(1);
    expect(snap.worldWidth).toBe(30);
    expect(snap.worldHeight).toBe(20);
    expect(snap.entities.length).toBe(SNAPSHOT_STRIDE);

    const view = readSnapshotEntity(snap, 0);
    expect(view.id).toBe(e1);
    expect(view.kind).toBe(2);
    expect(view.x).toBeCloseTo(4.5);
    expect(view.y).toBeCloseTo(6.25);
    expect(view.angle).toBeCloseTo(0.5);
    expect(view.size).toBeCloseTo(0.75);
    expect(view.color).toBe(0xff8800);

    world.free();
  });
});
