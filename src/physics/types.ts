import type { Vec2 } from '@core/index';

/** Opaque handle identifying a physics rigid body inside a {@link PhysicsAdapter}. */
export type BodyHandle = number & { readonly __brand: 'BodyHandle' };

/** Opaque handle identifying a physics collider inside a {@link PhysicsAdapter}. */
export type ColliderHandle = number & { readonly __brand: 'ColliderHandle' };

/** Opaque handle identifying a physics joint inside a {@link PhysicsAdapter}. */
export type JointHandle = number & { readonly __brand: 'JointHandle' };

/** Motion behavior of a rigid body. */
export type BodyKind = 'dynamic' | 'kinematic' | 'fixed';

/**
 * 16-bit collision group bitmasks used for membership and filter masks in physics queries and
 * contact resolution.
 */
export const COLLISION_GROUP = Object.freeze({
  CREATURE: 0x0001,
  PLANT: 0x0002,
  FRUIT: 0x0004,
  WALL: 0x0008,
  ALL: 0xffff,
} as const);

/**
 * Convex collider shape primitives supported by {@link PhysicsAdapter} (all dimensions in SI meters).
 */
export type ColliderShapeDesc =
  | { readonly kind: 'circle'; readonly radius: number }
  | { readonly kind: 'rect'; readonly halfWidth: number; readonly halfHeight: number }
  | { readonly kind: 'capsule'; readonly halfHeight: number; readonly radius: number }
  | { readonly kind: 'convex'; readonly vertices: readonly Vec2[] };

/**
 * Descriptor for creating a rigid body.
 */
export interface BodyDesc {
  /** Dynamic, kinematic, or fixed body. */
  readonly kind: BodyKind;
  /** Initial world position in meters. */
  readonly position: Vec2;
  /** Initial rotation in radians (default `0`). */
  readonly angle?: number;
  /** Linear velocity damping in `1/s` (default `0`). */
  readonly linearDamping?: number;
  /** Angular velocity damping in `1/s` (default `0`). */
  readonly angularDamping?: number;
  /** Whether the physics solver may put the body to sleep (default `false`). */
  readonly canSleep?: boolean;
}

/**
 * Descriptor for attaching a collider to an existing rigid body.
 */
export interface ColliderDesc {
  /** Owning rigid body handle. */
  readonly body: BodyHandle;
  /** Convex collider geometry in meters. */
  readonly shape: ColliderShapeDesc;
  /** Local offset relative to the owning body in meters (default `(0, 0)`). */
  readonly offset?: Vec2;
  /** Local rotation relative to the owning body in radians (default `0`). */
  readonly angle?: number;
  /** Mass density in `kg/m^2` (default `1`). */
  readonly density?: number;
  /** Bounciness coefficient in `[0, 1]` (default `0.1`). */
  readonly restitution?: number;
  /** Surface friction coefficient >= 0 (default `0.3`). */
  readonly friction?: number;
  /** When `true`, detects overlaps without physical impulse response (default `false`). */
  readonly isSensor?: boolean;
  /** 16-bit collision membership bitmask (default `COLLISION_GROUP.CREATURE`). */
  readonly collisionGroup?: number;
  /** 16-bit collision filter bitmask (default `COLLISION_GROUP.ALL`). */
  readonly collisionMask?: number;
  /** When `true`, emits collision events into the adapter's event queue (default `true`). */
  readonly activeEvents?: boolean;
}

/**
 * Descriptor for connecting two rigid bodies with a revolute or prismatic joint.
 */
export type JointDesc =
  | {
      readonly kind: 'revolute';
      readonly bodyA: BodyHandle;
      readonly bodyB: BodyHandle;
      readonly anchorA: Vec2;
      readonly anchorB: Vec2;
      readonly limits?: readonly [minRad: number, maxRad: number];
    }
  | {
      readonly kind: 'prismatic';
      readonly bodyA: BodyHandle;
      readonly bodyB: BodyHandle;
      readonly anchorA: Vec2;
      readonly anchorB: Vec2;
      readonly axis: Vec2;
      readonly limits?: readonly [minMeters: number, maxMeters: number];
    };

/**
 * World-space pose and velocities of a rigid body in SI units (`m`, `rad`, `m/s`, `rad/s`).
 */
export interface BodyTransform {
  /** Position in meters. */
  readonly position: Vec2;
  /** Rotation in radians. */
  readonly angle: number;
  /** Linear velocity in meters per second. */
  readonly linearVelocity: Vec2;
  /** Angular velocity in radians per second. */
  readonly angularVelocity: number;
}

/**
 * Contact or sensor overlap transition collected during `PhysicsAdapter.step()`.
 */
export interface CollisionEvent {
  /** First collider handle. */
  readonly colliderA: ColliderHandle;
  /** Second collider handle. */
  readonly colliderB: ColliderHandle;
  /** Rigid body owning `colliderA`. */
  readonly bodyA: BodyHandle;
  /** Rigid body owning `colliderB`. */
  readonly bodyB: BodyHandle;
  /** `true` when contact started, `false` when it ended. */
  readonly started: boolean;
  /** `true` if either collider is a sensor. */
  readonly isSensor: boolean;
}

/**
 * First collider intersection along a ray query.
 */
export interface RaycastHit {
  /** Hit collider handle. */
  readonly collider: ColliderHandle;
  /** Rigid body owning `collider`. */
  readonly body: BodyHandle;
  /** Distance along the normalized ray in meters (`0 <= toi <= maxDistance`). */
  readonly toi: number;
  /** World-space hit point in meters. */
  readonly point: Vec2;
  /** Outward unit surface normal at the hit point. */
  readonly normal: Vec2;
}

/**
 * Live handle counts exposed by a {@link PhysicsAdapter} for diagnostics and WASM leak checks.
 */
export interface PhysicsStats {
  /** Number of active rigid bodies. */
  readonly bodyCount: number;
  /** Number of active colliders. */
  readonly colliderCount: number;
  /** Number of active joints. */
  readonly jointCount: number;
}

/**
 * Engine-agnostic 2D rigid-body physics boundary (ADR 0001).
 * Only `src/physics/rapier-adapter.ts` imports Rapier; all other code targets this interface.
 */
export interface PhysicsAdapter {
  /**
   * Advances physics simulation by a fixed timestep `dt` in seconds.
   *
   * @param dt - Positive finite timestep in seconds (e.g. `1/30`).
   */
  step(dt: number): void;

  /** Creates a rigid body and returns its handle. */
  createBody(desc: BodyDesc): BodyHandle;

  /**
   * Removes a rigid body along with all colliders and joints attached to it.
   * Removing an unknown handle is a safe no-op.
   */
  removeBody(handle: BodyHandle): void;

  /** Creates a collider attached to `desc.body` and returns its handle. */
  createCollider(desc: ColliderDesc): ColliderHandle;

  /** Removes a collider by handle. Removing an unknown handle is a safe no-op. */
  removeCollider(handle: ColliderHandle): void;

  /** Connects two bodies with a joint and returns its handle. */
  createJoint(desc: JointDesc): JointHandle;

  /** Removes a joint by handle. Removing an unknown handle is a safe no-op. */
  removeJoint(handle: JointHandle): void;

  /** Reads the world transform and velocities of a rigid body. */
  getBodyTransform(handle: BodyHandle): BodyTransform;

  /** Teleports a rigid body to a new world position (meters) and rotation (radians). */
  setBodyTransform(handle: BodyHandle, position: Vec2, angle: number): void;

  /** Sets linear and angular velocities of a rigid body directly (`m/s`, `rad/s`). */
  setBodyVelocity(handle: BodyHandle, linearVelocity: Vec2, angularVelocity?: number): void;

  /** Applies a continuous force in Newtons, optionally at a world-space point (meters). */
  applyForce(handle: BodyHandle, force: Vec2, worldPoint?: Vec2): void;

  /** Applies an instantaneous impulse in `N·s`, optionally at a world-space point (meters). */
  applyImpulse(handle: BodyHandle, impulse: Vec2, worldPoint?: Vec2): void;

  /** Applies a continuous torque in `N·m`. */
  applyTorque(handle: BodyHandle, torque: number): void;

  /** Drains and returns all collision events recorded since the last drain. */
  drainCollisionEvents(): readonly CollisionEvent[];

  /**
   * Casts a ray from `origin` along `direction` up to `maxDistance` meters.
   *
   * @param origin - World origin in meters.
   * @param direction - Non-zero direction vector (normalized internally).
   * @param maxDistance - Positive maximum ray length in meters.
   * @param excludeBody - Optional body handle to ignore (e.g. the ray caster's own body).
   */
  castRay(
    origin: Vec2,
    direction: Vec2,
    maxDistance: number,
    excludeBody?: BodyHandle,
  ): RaycastHit | null;

  /** Returns live counts of bodies, colliders, and joints. */
  getStats(): PhysicsStats;

  /** Frees all underlying native/WASM physics memory. Must be called on teardown. */
  free(): void;
}
