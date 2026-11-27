import { defineComponent } from '@core/index';
import type { BodyHandle, ColliderHandle, JointHandle } from '@physics/types';

/**
 * World-space 2D pose of an entity in SI meters and radians.
 */
export interface TransformData {
  /** Horizontal world coordinate in meters. */
  x: number;
  /** Vertical world coordinate in meters. */
  y: number;
  /** Orientation angle in radians. */
  angle: number;
}

/**
 * Physics handles owned by an entity inside the world's {@link PhysicsAdapter}.
 */
export interface PhysicsBodyData {
  /** Primary rigid body handle. */
  readonly bodyHandle: BodyHandle;
  /** Optional secondary rigid body handles for articulated multi-body creatures. */
  readonly extraBodyHandles?: readonly BodyHandle[];
  /** All collider handles attached to this entity. */
  readonly colliderHandles: readonly ColliderHandle[];
  /** All joint handles owned by this entity. */
  readonly jointHandles: readonly JointHandle[];
  /** Bounding radius in meters for spatial hash indexing. */
  readonly boundingRadius: number;
  /** When `true`, the rigid body is fixed/immovable and skipped during `syncFromPhysics`. */
  readonly isFixed?: boolean;
}

/**
 * Compact visual metadata rendered in Phase 1 before the Phase 1.5 procedural appearance system.
 */
export interface RenderableStubData {
  /** Numeric entity kind tag (e.g. `1` = generic body, `2` = plant, `3` = obstacle). */
  readonly kind: number;
  /** Visual radius in meters. */
  readonly radius: number;
  /** 24-bit RGB hex color (`0xRRGGBB`). */
  readonly color: number;
}

/**
 * String classification tags attached to an entity (`herbivore`, `plant`, `species:rabbit`, ...).
 */
export interface TagsData {
  /** Mutable set of tags for fast membership checks. */
  readonly values: Set<string>;
}

/** ECS component storing an entity's 2D world transform. */
export const TransformComponent = defineComponent<TransformData>('transform', 'Transform');

/** ECS component storing an entity's physics handles and bounding radius. */
export const PhysicsBodyComponent = defineComponent<PhysicsBodyData>('physics-body', 'PhysicsBody');

/** ECS component storing Phase 1 basic render properties (`kind`, `radius`, `color`). */
export const RenderableStubComponent = defineComponent<RenderableStubData>(
  'renderable-stub',
  'RenderableStub',
);

/** ECS component storing entity classification tags. */
export const TagsComponent = defineComponent<TagsData>('tags', 'Tags');
