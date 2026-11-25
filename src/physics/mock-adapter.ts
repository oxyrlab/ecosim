import {
  assertFiniteNumber,
  assertFiniteVec2,
  InvalidParameterError,
  InvariantViolationError,
  length,
  normalize,
  type Vec2,
} from '@core/index';
import type {
  BodyDesc,
  BodyHandle,
  BodyTransform,
  ColliderDesc,
  ColliderHandle,
  CollisionEvent,
  JointDesc,
  JointHandle,
  PhysicsAdapter,
  PhysicsStats,
  RaycastHit,
} from './types';

interface MockBodyState {
  readonly kind: BodyDesc['kind'];
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  omega: number;
  fx: number;
  fy: number;
  torque: number;
  linearDamping: number;
  angularDamping: number;
  mass: number;
  inertia: number;
}

interface MockColliderState {
  readonly handle: ColliderHandle;
  readonly body: BodyHandle;
  readonly radius: number;
  readonly isSensor: boolean;
}

interface MockJointState {
  readonly handle: JointHandle;
  readonly bodyA: BodyHandle;
  readonly bodyB: BodyHandle;
}

function estimateColliderRadius(desc: ColliderDesc): number {
  switch (desc.shape.kind) {
    case 'circle':
      return desc.shape.radius;
    case 'rect':
      return Math.hypot(desc.shape.halfWidth, desc.shape.halfHeight);
    case 'capsule':
      return desc.shape.halfHeight + desc.shape.radius;
    case 'convex': {
      let maxR = 0.05;
      for (const v of desc.shape.vertices) {
        const r = Math.hypot(v.x, v.y);
        if (r > maxR) maxR = r;
      }
      return maxR;
    }
  }
}

/**
 * Creates a lightweight pure-JavaScript {@link PhysicsAdapter} for fast unit tests that do not
 * require Rapier WASM. Uses deterministic semi-implicit Euler integration with circle raycasts.
 *
 * @returns A {@link PhysicsAdapter} backed by in-memory maps.
 */
export function createMockPhysicsAdapter(): PhysicsAdapter {
  let nextHandle = 1;
  let freed = false;
  const bodies = new Map<BodyHandle, MockBodyState>();
  const colliders = new Map<ColliderHandle, MockColliderState>();
  const joints = new Map<JointHandle, MockJointState>();
  let events: CollisionEvent[] = [];

  const assertNotFreed = (): void => {
    if (freed) {
      throw new InvariantViolationError('MockPhysicsAdapter has already been freed.');
    }
  };

  const requireBody = (handle: BodyHandle): MockBodyState => {
    assertNotFreed();
    const body = bodies.get(handle);
    if (body === undefined) {
      throw new InvariantViolationError(`Unknown physics body handle ${handle}.`);
    }
    return body;
  };

  return {
    step(dt: number): void {
      assertNotFreed();
      assertFiniteNumber('dt', dt, 'MockPhysicsAdapter.step');
      if (dt <= 0) {
        throw new InvalidParameterError('dt', dt, 'a finite number > 0', 'MockPhysicsAdapter.step');
      }

      for (const body of bodies.values()) {
        if (body.kind !== 'dynamic') continue;
        body.vx += (body.fx / body.mass) * dt;
        body.vy += (body.fy / body.mass) * dt;
        body.omega += (body.torque / body.inertia) * dt;

        const linearFactor = Math.max(0, 1 - body.linearDamping * dt);
        const angularFactor = Math.max(0, 1 - body.angularDamping * dt);
        body.vx *= linearFactor;
        body.vy *= angularFactor;
        body.omega *= angularFactor;

        body.x += body.vx * dt;
        body.y += body.vy * dt;
        body.angle += body.omega * dt;

        body.fx = 0;
        body.fy = 0;
        body.torque = 0;
      }
    },

    createBody(desc: BodyDesc): BodyHandle {
      assertNotFreed();
      assertFiniteVec2('position', desc.position, 'MockPhysicsAdapter.createBody');
      const angle = desc.angle ?? 0;
      assertFiniteNumber('angle', angle, 'MockPhysicsAdapter.createBody');

      const handle = nextHandle++ as BodyHandle;
      bodies.set(handle, {
        kind: desc.kind,
        x: desc.position.x,
        y: desc.position.y,
        angle,
        vx: 0,
        vy: 0,
        omega: 0,
        fx: 0,
        fy: 0,
        torque: 0,
        linearDamping: desc.linearDamping ?? 0,
        angularDamping: desc.angularDamping ?? 0,
        mass: 1,
        inertia: 1,
      });
      return handle;
    },

    removeBody(handle: BodyHandle): void {
      assertNotFreed();
      if (!bodies.delete(handle)) return;
      for (const [colHandle, col] of colliders.entries()) {
        if (col.body === handle) colliders.delete(colHandle);
      }
      for (const [jointHandle, joint] of joints.entries()) {
        if (joint.bodyA === handle || joint.bodyB === handle) joints.delete(jointHandle);
      }
    },

    createCollider(desc: ColliderDesc): ColliderHandle {
      requireBody(desc.body);
      const handle = nextHandle++ as ColliderHandle;
      colliders.set(handle, {
        handle,
        body: desc.body,
        radius: estimateColliderRadius(desc),
        isSensor: desc.isSensor ?? false,
      });
      return handle;
    },

    removeCollider(handle: ColliderHandle): void {
      assertNotFreed();
      colliders.delete(handle);
    },

    createJoint(desc: JointDesc): JointHandle {
      requireBody(desc.bodyA);
      requireBody(desc.bodyB);
      const handle = nextHandle++ as JointHandle;
      joints.set(handle, { handle, bodyA: desc.bodyA, bodyB: desc.bodyB });
      return handle;
    },

    removeJoint(handle: JointHandle): void {
      assertNotFreed();
      joints.delete(handle);
    },

    getBodyTransform(handle: BodyHandle): BodyTransform {
      const b = requireBody(handle);
      return {
        position: { x: b.x, y: b.y },
        angle: b.angle,
        linearVelocity: { x: b.vx, y: b.vy },
        angularVelocity: b.omega,
      };
    },

    setBodyTransform(handle: BodyHandle, position: Vec2, angle: number): void {
      const b = requireBody(handle);
      assertFiniteVec2('position', position, 'MockPhysicsAdapter.setBodyTransform');
      assertFiniteNumber('angle', angle, 'MockPhysicsAdapter.setBodyTransform');
      b.x = position.x;
      b.y = position.y;
      b.angle = angle;
    },

    setBodyVelocity(handle: BodyHandle, linearVelocity: Vec2, angularVelocity = 0): void {
      const b = requireBody(handle);
      assertFiniteVec2('linearVelocity', linearVelocity, 'MockPhysicsAdapter.setBodyVelocity');
      assertFiniteNumber('angularVelocity', angularVelocity, 'MockPhysicsAdapter.setBodyVelocity');
      b.vx = linearVelocity.x;
      b.vy = linearVelocity.y;
      b.omega = angularVelocity;
    },

    applyForce(handle: BodyHandle, force: Vec2, worldPoint?: Vec2): void {
      const b = requireBody(handle);
      assertFiniteVec2('force', force, 'MockPhysicsAdapter.applyForce');
      if (worldPoint !== undefined) {
        assertFiniteVec2('worldPoint', worldPoint, 'MockPhysicsAdapter.applyForce');
        const rx = worldPoint.x - b.x;
        const ry = worldPoint.y - b.y;
        b.torque += rx * force.y - ry * force.x;
      }
      b.fx += force.x;
      b.fy += force.y;
    },

    applyImpulse(handle: BodyHandle, impulse: Vec2, worldPoint?: Vec2): void {
      const b = requireBody(handle);
      assertFiniteVec2('impulse', impulse, 'MockPhysicsAdapter.applyImpulse');
      if (b.kind !== 'dynamic') return;
      b.vx += impulse.x / b.mass;
      b.vy += impulse.y / b.mass;
      if (worldPoint !== undefined) {
        assertFiniteVec2('worldPoint', worldPoint, 'MockPhysicsAdapter.applyImpulse');
        const rx = worldPoint.x - b.x;
        const ry = worldPoint.y - b.y;
        b.omega += (rx * impulse.y - ry * impulse.x) / b.inertia;
      }
    },

    applyTorque(handle: BodyHandle, torque: number): void {
      const b = requireBody(handle);
      assertFiniteNumber('torque', torque, 'MockPhysicsAdapter.applyTorque');
      b.torque += torque;
    },

    drainCollisionEvents(): readonly CollisionEvent[] {
      assertNotFreed();
      const drained = events;
      events = [];
      return drained;
    },

    castRay(
      origin: Vec2,
      direction: Vec2,
      maxDistance: number,
      excludeBody?: BodyHandle,
    ): RaycastHit | null {
      assertNotFreed();
      assertFiniteVec2('origin', origin, 'MockPhysicsAdapter.castRay');
      assertFiniteVec2('direction', direction, 'MockPhysicsAdapter.castRay');
      if (!Number.isFinite(maxDistance) || maxDistance <= 0) {
        throw new InvalidParameterError(
          'maxDistance',
          maxDistance,
          'a finite number > 0',
          'MockPhysicsAdapter.castRay',
        );
      }
      if (length(direction) === 0) {
        throw new InvalidParameterError(
          'direction',
          direction,
          'a non-zero direction vector',
          'MockPhysicsAdapter.castRay',
        );
      }

      const dir = normalize(direction);
      let closest: RaycastHit | null = null;

      for (const col of colliders.values()) {
        if (excludeBody !== undefined && col.body === excludeBody) continue;
        const body = bodies.get(col.body);
        if (body === undefined) continue;

        const ocx = origin.x - body.x;
        const ocy = origin.y - body.y;
        const b = ocx * dir.x + ocy * dir.y;
        const c = ocx * ocx + ocy * ocy - col.radius * col.radius;
        const disc = b * b - c;
        if (disc < 0) continue;

        const t = -b - Math.sqrt(disc);
        if (t < 0 || t > maxDistance) continue;
        if (closest === null || t < closest.toi) {
          const hitX = origin.x + dir.x * t;
          const hitY = origin.y + dir.y * t;
          const normal = normalize({ x: hitX - body.x, y: hitY - body.y });
          closest = {
            collider: col.handle,
            body: col.body,
            toi: t,
            point: { x: hitX, y: hitY },
            normal,
          };
        }
      }

      return closest;
    },

    getStats(): PhysicsStats {
      return {
        bodyCount: bodies.size,
        colliderCount: colliders.size,
        jointCount: joints.size,
      };
    },

    free(): void {
      bodies.clear();
      colliders.clear();
      joints.clear();
      events = [];
      freed = true;
    },
  };
}
