import { RenderableStubComponent, TransformComponent, type World } from '@world/index';

/**
 * Number of `Float32` values packed per entity in {@link RenderSnapshot.entities}:
 * `[id, kind, x, y, angle, size, color]`.
 */
export const SNAPSHOT_STRIDE = 7;

/**
 * Compact, Transferable render snapshot sent from the simulation Worker to the main thread.
 */
export interface RenderSnapshot {
  /** Current fixed simulation tick. */
  readonly tick: number;
  /** Elapsed simulation time in seconds. */
  readonly timeSeconds: number;
  /** Number of entities packed in `entities`. */
  readonly entityCount: number;
  /** World width in meters. */
  readonly worldWidth: number;
  /** World height in meters. */
  readonly worldHeight: number;
  /**
   * Interleaved `Float32Array` of length `entityCount * SNAPSHOT_STRIDE` storing
   * `[id, kind, x, y, angle, size, color]` per entity.
   */
  readonly entities: Float32Array;
}

/**
 * Unpacked record for one entity read from a {@link RenderSnapshot}.
 */
export interface SnapshotEntityView {
  readonly id: number;
  readonly kind: number;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly size: number;
  readonly color: number;
}

/**
 * Packs all renderable entities of `world` into a fresh Transferable {@link RenderSnapshot}.
 *
 * @param world - Simulation world to snapshot.
 * @returns Compact {@link RenderSnapshot} safe to transfer across a Web Worker boundary.
 */
export function buildRenderSnapshot(world: World): RenderSnapshot {
  const entities = world.ecs.query(TransformComponent, RenderableStubComponent);
  const buffer = new Float32Array(entities.length * SNAPSHOT_STRIDE);

  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i] as (typeof entities)[number];
    const transform = world.ecs.requireComponent(entity, TransformComponent);
    const renderable = world.ecs.requireComponent(entity, RenderableStubComponent);
    const offset = i * SNAPSHOT_STRIDE;

    buffer[offset] = entity;
    buffer[offset + 1] = renderable.kind;
    buffer[offset + 2] = transform.x;
    buffer[offset + 3] = transform.y;
    buffer[offset + 4] = transform.angle;
    buffer[offset + 5] = renderable.radius;
    buffer[offset + 6] = renderable.color;
  }

  return {
    tick: world.tick,
    timeSeconds: world.timeSeconds,
    entityCount: entities.length,
    worldWidth: world.config.widthMeters,
    worldHeight: world.config.heightMeters,
    entities: buffer,
  };
}

/**
 * Reads entity `index` (`0 <= index < snapshot.entityCount`) from a {@link RenderSnapshot}.
 */
export function readSnapshotEntity(snapshot: RenderSnapshot, index: number): SnapshotEntityView {
  const offset = index * SNAPSHOT_STRIDE;
  const buf = snapshot.entities;
  return {
    id: buf[offset] as number,
    kind: buf[offset + 1] as number,
    x: buf[offset + 2] as number,
    y: buf[offset + 3] as number,
    angle: buf[offset + 4] as number,
    size: buf[offset + 5] as number,
    color: buf[offset + 6] as number,
  };
}
