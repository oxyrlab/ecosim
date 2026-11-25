import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import {
  assertFiniteNumber,
  assertFiniteVec2,
  InvalidParameterError,
  InvariantViolationError,
  length,
  normalize,
  type Vec2,
} from '@core/index';
import { initRapier, isRapierInitialized } from './rapier-init';
import {
  COLLISION_GROUP,
  type BodyDesc,
  type BodyHandle,
  type BodyTransform,
  type ColliderDesc,
  type ColliderHandle,
  type CollisionEvent,
  type JointDesc,
  type JointHandle,
  type PhysicsAdapter,
  type PhysicsStats,
  type RaycastHit,
} from './types';

function packInteractionGroups(membership: number, filter: number): number {
  return (((membership & 0xffff) << 16) | (filter & 0xffff)) >>> 0;
}

function buildColliderDesc(desc: ColliderDesc): RAPIER.ColliderDesc {
  let colliderDesc: RAPIER.ColliderDesc | null = null;
  switch (desc.shape.kind) {
    case 'circle':
      if (!Number.isFinite(desc.shape.radius) || desc.shape.radius <= 0) {
        throw new InvalidParameterError(
          'radius',
          desc.shape.radius,
          'a finite number > 0',
          'RapierAdapter.createCollider',
        );
      }
      colliderDesc = RAPIER.ColliderDesc.ball(desc.shape.radius);
      break;
    case 'rect':
      if (
        !Number.isFinite(desc.shape.halfWidth) ||
        desc.shape.halfWidth <= 0 ||
        !Number.isFinite(desc.shape.halfHeight) ||
        desc.shape.halfHeight <= 0
      ) {
        throw new InvalidParameterError(
          'rect',
          [desc.shape.halfWidth, desc.shape.halfHeight],
          'positive finite halfWidth and halfHeight',
          'RapierAdapter.createCollider',
        );
      }
      colliderDesc = RAPIER.ColliderDesc.cuboid(desc.shape.halfWidth, desc.shape.halfHeight);
      break;
    case 'capsule':
      if (
        !Number.isFinite(desc.shape.halfHeight) ||
        desc.shape.halfHeight < 0 ||
        !Number.isFinite(desc.shape.radius) ||
        desc.shape.radius <= 0
      ) {
        throw new InvalidParameterError(
          'capsule',
          [desc.shape.halfHeight, desc.shape.radius],
          'finite halfHeight >= 0 and radius > 0',
          'RapierAdapter.createCollider',
        );
      }
      colliderDesc = RAPIER.ColliderDesc.capsule(desc.shape.halfHeight, desc.shape.radius);
      break;
    case 'convex': {
      if (desc.shape.vertices.length < 3) {
        throw new InvalidParameterError(
          'vertices',
          desc.shape.vertices.length,
          'at least 3 vertices for a convex hull',
          'RapierAdapter.createCollider',
        );
      }
      const flat = new Float32Array(desc.shape.vertices.length * 2);
      for (let i = 0; i < desc.shape.vertices.length; i += 1) {
        const v = desc.shape.vertices[i];
        if (v === undefined) continue;
        assertFiniteVec2(`vertices[${i}]`, v, 'RapierAdapter.createCollider');
        flat[i * 2] = v.x;
        flat[i * 2 + 1] = v.y;
      }
      colliderDesc = RAPIER.ColliderDesc.convexHull(flat);
      if (colliderDesc === null) {
        throw new InvalidParameterError(
          'vertices',
          desc.shape.vertices,
          'non-degenerate vertices forming a valid convex hull',
          'RapierAdapter.createCollider',
        );
      }
      break;
    }
  }

  if (desc.offset !== undefined) {
    assertFiniteVec2('offset', desc.offset, 'RapierAdapter.createCollider');
    colliderDesc.setTranslation(desc.offset.x, desc.offset.y);
  }
  if (desc.angle !== undefined) {
    assertFiniteNumber('angle', desc.angle, 'RapierAdapter.createCollider');
    colliderDesc.setRotation(desc.angle);
  }
  colliderDesc.setDensity(desc.density ?? 1);
  colliderDesc.setRestitution(desc.restitution ?? 0.1);
  colliderDesc.setFriction(desc.friction ?? 0.3);
  colliderDesc.setSensor(desc.isSensor ?? false);

  const groups = packInteractionGroups(
    desc.collisionGroup ?? COLLISION_GROUP.CREATURE,
    desc.collisionMask ?? COLLISION_GROUP.ALL,
  );
  colliderDesc.setCollisionGroups(groups);

  if (desc.activeEvents ?? true) {
    colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  }

  return colliderDesc;
}

/**
 * Creates a deterministic Rapier 2D (WASM) {@link PhysicsAdapter} on a zero-gravity top-down plane.
 * Requires {@link initRapier} to have completed before calling.
 *
 * @returns A live Rapier-backed {@link PhysicsAdapter}. Remember to call `free()` on teardown.
 * @throws InvariantViolationError if {@link initRapier} has not been awaited yet.
 */
export function createRapierPhysicsAdapterSync(): PhysicsAdapter {
  if (!isRapierInitialized()) {
    throw new InvariantViolationError(
      'Rapier WASM is not initialized. Await initRapier() or use createRapierPhysicsAdapter() first.',
    );
  }

  const world = new RAPIER.World({ x: 0, y: 0 });
  const eventQueue = new RAPIER.EventQueue(true);
  const activeBodies = new Set<BodyHandle>();
  const activeColliders = new Map<ColliderHandle, BodyHandle>();
  const activeJoints = new Map<JointHandle, readonly [BodyHandle, BodyHandle]>();
  const forcedBodies = new Set<BodyHandle>();
  let freed = false;
  let queriesDirty = false;
  let pendingEvents: CollisionEvent[] = [];

  const assertNotFreed = (): void => {
    if (freed) {
      throw new InvariantViolationError('RapierPhysicsAdapter has already been freed.');
    }
  };

  const requireBody = (handle: BodyHandle): RAPIER.RigidBody => {
    assertNotFreed();
    if (!activeBodies.has(handle)) {
      throw new InvariantViolationError(`Unknown Rapier RigidBody handle ${handle}.`);
    }
    const body = world.getRigidBody(handle);
    if (body === null || body === undefined) {
      throw new InvariantViolationError(`Unknown Rapier RigidBody handle ${handle}.`);
    }
    return body;
  };

  const syncQueriesIfDirty = (): void => {
    if (!queriesDirty) return;
    const prevTimestep = world.timestep;
    world.timestep = 0;
    world.step();
    world.timestep = prevTimestep;
    queriesDirty = false;
  };

  return {
    step(dt: number): void {
      assertNotFreed();
      assertFiniteNumber('dt', dt, 'RapierPhysicsAdapter.step');
      if (dt <= 0) {
        throw new InvalidParameterError(
          'dt',
          dt,
          'a finite number > 0',
          'RapierPhysicsAdapter.step',
        );
      }

      world.timestep = dt;
      world.step(eventQueue);
      queriesDirty = false;

      // Rapier keeps addForce/addTorque persistent across steps; clear per-tick forces after step.
      for (const handle of forcedBodies) {
        const body = world.getRigidBody(handle);
        if (body !== null && body !== undefined) {
          body.resetForces(false);
          body.resetTorques(false);
        }
      }
      forcedBodies.clear();

      eventQueue.drainCollisionEvents((h1: number, h2: number, started: boolean) => {
        const col1 = world.getCollider(h1);
        const col2 = world.getCollider(h2);
        const parent1 = col1?.parent();
        const parent2 = col2?.parent();
        if (
          parent1 === null ||
          parent1 === undefined ||
          parent2 === null ||
          parent2 === undefined
        ) {
          return;
        }
        pendingEvents.push({
          colliderA: h1 as ColliderHandle,
          colliderB: h2 as ColliderHandle,
          bodyA: parent1.handle as BodyHandle,
          bodyB: parent2.handle as BodyHandle,
          started,
          isSensor: col1.isSensor() || col2.isSensor(),
        });
      });
    },

    createBody(desc: BodyDesc): BodyHandle {
      assertNotFreed();
      assertFiniteVec2('position', desc.position, 'RapierPhysicsAdapter.createBody');
      const angle = desc.angle ?? 0;
      assertFiniteNumber('angle', angle, 'RapierPhysicsAdapter.createBody');

      const rbDesc =
        desc.kind === 'dynamic'
          ? RAPIER.RigidBodyDesc.dynamic()
          : desc.kind === 'kinematic'
            ? RAPIER.RigidBodyDesc.kinematicPositionBased()
            : RAPIER.RigidBodyDesc.fixed();

      rbDesc
        .setTranslation(desc.position.x, desc.position.y)
        .setRotation(angle)
        .setLinearDamping(desc.linearDamping ?? 0)
        .setAngularDamping(desc.angularDamping ?? 0)
        .setCanSleep(desc.canSleep ?? false);

      const body = world.createRigidBody(rbDesc);
      const handle = body.handle as BodyHandle;
      activeBodies.add(handle);
      queriesDirty = true;
      return handle;
    },

    removeBody(handle: BodyHandle): void {
      assertNotFreed();
      if (!activeBodies.delete(handle)) return;
      forcedBodies.delete(handle);
      for (const [colHandle, owner] of activeColliders.entries()) {
        if (owner === handle) activeColliders.delete(colHandle);
      }
      for (const [jointHandle, [a, b]] of activeJoints.entries()) {
        if (a === handle || b === handle) activeJoints.delete(jointHandle);
      }
      const body = world.getRigidBody(handle);
      if (body === null || body === undefined) return;
      world.removeRigidBody(body);
      queriesDirty = true;
    },

    createCollider(desc: ColliderDesc): ColliderHandle {
      const body = requireBody(desc.body);
      const colliderDesc = buildColliderDesc(desc);
      const collider = world.createCollider(colliderDesc, body);
      const handle = collider.handle as ColliderHandle;
      activeColliders.set(handle, desc.body);
      queriesDirty = true;
      return handle;
    },

    removeCollider(handle: ColliderHandle): void {
      assertNotFreed();
      if (!activeColliders.delete(handle)) return;
      const collider = world.getCollider(handle);
      if (collider === null || collider === undefined) return;
      world.removeCollider(collider, true);
      queriesDirty = true;
    },

    createJoint(desc: JointDesc): JointHandle {
      const bodyA = requireBody(desc.bodyA);
      const bodyB = requireBody(desc.bodyB);
      assertFiniteVec2('anchorA', desc.anchorA, 'RapierPhysicsAdapter.createJoint');
      assertFiniteVec2('anchorB', desc.anchorB, 'RapierPhysicsAdapter.createJoint');

      let jointData: RAPIER.JointData;
      if (desc.kind === 'revolute') {
        jointData = RAPIER.JointData.revolute(desc.anchorA, desc.anchorB);
      } else {
        assertFiniteVec2('axis', desc.axis, 'RapierPhysicsAdapter.createJoint');
        if (length(desc.axis) === 0) {
          throw new InvalidParameterError(
            'axis',
            desc.axis,
            'a non-zero axis vector',
            'RapierPhysicsAdapter.createJoint',
          );
        }
        jointData = RAPIER.JointData.prismatic(desc.anchorA, desc.anchorB, normalize(desc.axis));
      }

      if (desc.limits !== undefined) {
        const [minLimit, maxLimit] = desc.limits;
        assertFiniteNumber('limits[0]', minLimit, 'RapierPhysicsAdapter.createJoint');
        assertFiniteNumber('limits[1]', maxLimit, 'RapierPhysicsAdapter.createJoint');
        jointData.limitsEnabled = true;
        jointData.limits = [minLimit, maxLimit];
      }

      const joint = world.createImpulseJoint(jointData, bodyA, bodyB, true);
      const handle = joint.handle as JointHandle;
      activeJoints.set(handle, [desc.bodyA, desc.bodyB]);
      return handle;
    },

    removeJoint(handle: JointHandle): void {
      assertNotFreed();
      if (!activeJoints.delete(handle)) return;
      const joint = world.getImpulseJoint(handle);
      if (joint === null || joint === undefined) return;
      world.removeImpulseJoint(joint, true);
    },

    getBodyTransform(handle: BodyHandle): BodyTransform {
      const body = requireBody(handle);
      const t = body.translation();
      const v = body.linvel();
      return {
        position: { x: t.x, y: t.y },
        angle: body.rotation(),
        linearVelocity: { x: v.x, y: v.y },
        angularVelocity: body.angvel(),
      };
    },

    setBodyTransform(handle: BodyHandle, position: Vec2, angle: number): void {
      const body = requireBody(handle);
      assertFiniteVec2('position', position, 'RapierPhysicsAdapter.setBodyTransform');
      assertFiniteNumber('angle', angle, 'RapierPhysicsAdapter.setBodyTransform');
      body.setTranslation(position, true);
      body.setRotation(angle, true);
      world.propagateModifiedBodyPositionsToColliders();
      queriesDirty = true;
    },

    setBodyVelocity(handle: BodyHandle, linearVelocity: Vec2, angularVelocity = 0): void {
      const body = requireBody(handle);
      assertFiniteVec2('linearVelocity', linearVelocity, 'RapierPhysicsAdapter.setBodyVelocity');
      assertFiniteNumber(
        'angularVelocity',
        angularVelocity,
        'RapierPhysicsAdapter.setBodyVelocity',
      );
      body.setLinvel(linearVelocity, true);
      body.setAngvel(angularVelocity, true);
    },

    applyForce(handle: BodyHandle, force: Vec2, worldPoint?: Vec2): void {
      const body = requireBody(handle);
      assertFiniteVec2('force', force, 'RapierPhysicsAdapter.applyForce');
      if (worldPoint !== undefined) {
        assertFiniteVec2('worldPoint', worldPoint, 'RapierPhysicsAdapter.applyForce');
        body.addForceAtPoint(force, worldPoint, true);
      } else {
        body.addForce(force, true);
      }
      forcedBodies.add(handle);
    },

    applyImpulse(handle: BodyHandle, impulse: Vec2, worldPoint?: Vec2): void {
      const body = requireBody(handle);
      assertFiniteVec2('impulse', impulse, 'RapierPhysicsAdapter.applyImpulse');
      if (worldPoint !== undefined) {
        assertFiniteVec2('worldPoint', worldPoint, 'RapierPhysicsAdapter.applyImpulse');
        body.applyImpulseAtPoint(impulse, worldPoint, true);
      } else {
        body.applyImpulse(impulse, true);
      }
    },

    applyTorque(handle: BodyHandle, torque: number): void {
      const body = requireBody(handle);
      assertFiniteNumber('torque', torque, 'RapierPhysicsAdapter.applyTorque');
      body.addTorque(torque, true);
      forcedBodies.add(handle);
    },

    drainCollisionEvents(): readonly CollisionEvent[] {
      assertNotFreed();
      const out = pendingEvents;
      pendingEvents = [];
      return out;
    },

    castRay(
      origin: Vec2,
      direction: Vec2,
      maxDistance: number,
      excludeBody?: BodyHandle,
    ): RaycastHit | null {
      assertNotFreed();
      assertFiniteVec2('origin', origin, 'RapierPhysicsAdapter.castRay');
      assertFiniteVec2('direction', direction, 'RapierPhysicsAdapter.castRay');
      if (!Number.isFinite(maxDistance) || maxDistance <= 0) {
        throw new InvalidParameterError(
          'maxDistance',
          maxDistance,
          'a finite number > 0',
          'RapierPhysicsAdapter.castRay',
        );
      }
      if (length(direction) === 0) {
        throw new InvalidParameterError(
          'direction',
          direction,
          'a non-zero direction vector',
          'RapierPhysicsAdapter.castRay',
        );
      }

      syncQueriesIfDirty();
      const dir = normalize(direction);
      const ray = new RAPIER.Ray(origin, dir);
      const excluded =
        excludeBody !== undefined && activeBodies.has(excludeBody)
          ? (world.getRigidBody(excludeBody) ?? undefined)
          : undefined;
      const hit = world.castRayAndGetNormal(
        ray,
        maxDistance,
        true,
        undefined,
        undefined,
        undefined,
        excluded,
      );
      if (hit === null) return null;

      const parent = hit.collider.parent();
      if (parent === null || parent === undefined) return null;
      const point = ray.pointAt(hit.timeOfImpact);
      return {
        collider: hit.collider.handle as ColliderHandle,
        body: parent.handle as BodyHandle,
        toi: hit.timeOfImpact,
        point: { x: point.x, y: point.y },
        normal: { x: hit.normal.x, y: hit.normal.y },
      };
    },

    getStats(): PhysicsStats {
      assertNotFreed();
      return {
        bodyCount: world.bodies.len(),
        colliderCount: world.colliders.len(),
        jointCount: world.impulseJoints.len(),
      };
    },

    free(): void {
      if (freed) return;
      freed = true;
      activeBodies.clear();
      activeColliders.clear();
      activeJoints.clear();
      pendingEvents = [];
      eventQueue.free();
      world.free();
    },
  };
}

/**
 * Ensures Rapier WASM is initialized and creates a deterministic {@link PhysicsAdapter}.
 */
export async function createRapierPhysicsAdapter(): Promise<PhysicsAdapter> {
  await initRapier();
  return createRapierPhysicsAdapterSync();
}
