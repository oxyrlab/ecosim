import { describe, expect, it } from 'vitest';
import { InvalidParameterError, InvariantViolationError } from '@core/index';
import { createRapierPhysicsAdapter } from './rapier-adapter';
import { COLLISION_GROUP } from './types';

describe('RapierPhysicsAdapter (real Rapier 2D deterministic WASM)', () => {
  it('simulates motion, forces, impulses, collisions, joints, and raycasts', async () => {
    const adapter = await createRapierPhysicsAdapter();

    const bodyA = adapter.createBody({
      kind: 'dynamic',
      position: { x: 0, y: 0 },
      linearDamping: 0,
    });
    const bodyB = adapter.createBody({
      kind: 'dynamic',
      position: { x: 2, y: 0 },
      linearDamping: 0,
    });
    const fixedWall = adapter.createBody({
      kind: 'fixed',
      position: { x: 6, y: 0 },
    });

    const colA = adapter.createCollider({
      body: bodyA,
      shape: { kind: 'circle', radius: 0.5 },
      collisionGroup: COLLISION_GROUP.CREATURE,
      collisionMask: COLLISION_GROUP.ALL,
    });
    const colB = adapter.createCollider({
      body: bodyB,
      shape: { kind: 'capsule', halfHeight: 0.2, radius: 0.4 },
      offset: { x: 0, y: 0 },
      angle: 0,
    });
    const colWall = adapter.createCollider({
      body: fixedWall,
      shape: { kind: 'rect', halfWidth: 0.5, halfHeight: 2 },
      collisionGroup: COLLISION_GROUP.WALL,
      collisionMask: COLLISION_GROUP.ALL,
    });

    // Raycast from bodyA towards bodyB, excluding bodyA
    const hit = adapter.castRay({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, bodyA);
    expect(hit).not.toBeNull();
    expect(hit?.body).toBe(bodyB);
    expect(hit?.collider).toBe(colB);
    expect(hit?.toi).toBeGreaterThan(1);
    expect(hit?.toi).toBeLessThan(2);
    expect(adapter.castRay({ x: 0, y: 10 }, { x: 0, y: 1 }, 5)).toBeNull();

    // Propel bodyA into bodyB to produce a collision event
    adapter.setBodyVelocity(bodyA, { x: 6, y: 0 });
    let sawCollision = false;
    for (let i = 0; i < 30; i += 1) {
      adapter.step(1 / 30);
      const events = adapter.drainCollisionEvents();
      if (
        events.some(
          (e) =>
            e.started &&
            ((e.bodyA === bodyA && e.bodyB === bodyB) || (e.bodyA === bodyB && e.bodyB === bodyA)),
        )
      ) {
        sawCollision = true;
      }
    }
    expect(sawCollision).toBe(true);
    expect(adapter.getBodyTransform(bodyB).position.x).toBeGreaterThan(2);

    // Test forces, impulses, torques, convex collider, and joints
    adapter.applyForce(bodyA, { x: 2, y: 1 });
    adapter.applyForce(bodyA, { x: 1, y: 0 }, { x: 0, y: 0.5 });
    adapter.applyImpulse(bodyA, { x: 0.5, y: 0 });
    adapter.applyImpulse(bodyA, { x: 0, y: 0.5 }, { x: 0.2, y: 0 });
    adapter.applyTorque(bodyA, 1);

    const triBody = adapter.createBody({ kind: 'kinematic', position: { x: -3, y: 0 } });
    adapter.createCollider({
      body: triBody,
      shape: {
        kind: 'convex',
        vertices: [
          { x: -0.3, y: -0.2 },
          { x: 0.3, y: -0.2 },
          { x: 0, y: 0.4 },
        ],
      },
      isSensor: true,
    });
    adapter.setBodyTransform(triBody, { x: -4, y: 1 }, 0.5);
    expect(adapter.getBodyTransform(triBody).position.x).toBeCloseTo(-4);

    const revJoint = adapter.createJoint({
      kind: 'revolute',
      bodyA,
      bodyB,
      anchorA: { x: 0.5, y: 0 },
      anchorB: { x: -0.5, y: 0 },
      limits: [-0.5, 0.5],
    });
    const prisJoint = adapter.createJoint({
      kind: 'prismatic',
      bodyA,
      bodyB: fixedWall,
      anchorA: { x: 0, y: 0 },
      anchorB: { x: 0, y: 0 },
      axis: { x: 1, y: 0 },
      limits: [-2, 2],
    });
    expect(adapter.getStats().jointCount).toBe(2);

    adapter.removeJoint(revJoint);
    adapter.removeJoint(revJoint); // idempotent
    adapter.removeJoint(prisJoint);
    adapter.removeCollider(colA);
    adapter.removeCollider(colA); // idempotent
    adapter.removeCollider(colWall);
    expect(adapter.getStats().jointCount).toBe(0);

    // Verify per-tick forces are cleared after step() and do not accumulate persistently
    const probe = adapter.createBody({
      kind: 'dynamic',
      position: { x: 0, y: 10 },
      linearDamping: 0,
    });
    adapter.createCollider({ body: probe, shape: { kind: 'circle', radius: 0.5 } });
    adapter.applyForce(probe, { x: 2, y: 0 });
    adapter.step(1 / 30);
    const vxAfterStep1 = adapter.getBodyTransform(probe).linearVelocity.x;
    adapter.step(1 / 30);
    const vxAfterStep2 = adapter.getBodyTransform(probe).linearVelocity.x;
    expect(vxAfterStep1).toBeGreaterThan(0);
    expect(vxAfterStep2).toBeCloseTo(vxAfterStep1, 5);

    adapter.free();
    adapter.free(); // idempotent
    expect(() => adapter.step(1 / 30)).toThrow(InvariantViolationError);
  });

  it('leaves zero lingering Rapier WASM handles after spawning and removing 50 jointed creatures', async () => {
    const adapter = await createRapierPhysicsAdapter();

    for (let i = 0; i < 50; i += 1) {
      const torso = adapter.createBody({ kind: 'dynamic', position: { x: i * 2, y: 0 } });
      const tail = adapter.createBody({ kind: 'dynamic', position: { x: i * 2 - 0.6, y: 0 } });
      adapter.createCollider({ body: torso, shape: { kind: 'circle', radius: 0.3 } });
      adapter.createCollider({
        body: tail,
        shape: { kind: 'capsule', halfHeight: 0.15, radius: 0.08 },
      });
      adapter.createJoint({
        kind: 'revolute',
        bodyA: torso,
        bodyB: tail,
        anchorA: { x: -0.3, y: 0 },
        anchorB: { x: 0.2, y: 0 },
      });

      adapter.step(1 / 30);
      adapter.removeBody(tail);
      adapter.removeBody(torso);
      adapter.removeBody(torso); // safe no-op
    }

    expect(adapter.getStats()).toEqual({ bodyCount: 0, colliderCount: 0, jointCount: 0 });
    adapter.free();
  });

  it('rejects invalid parameters and unknown handles cleanly', async () => {
    const adapter = await createRapierPhysicsAdapter();
    const b = adapter.createBody({ kind: 'dynamic', position: { x: 0, y: 0 } });

    expect(() => adapter.step(0)).toThrow(InvalidParameterError);
    expect(() => adapter.createCollider({ body: b, shape: { kind: 'circle', radius: 0 } })).toThrow(
      InvalidParameterError,
    );
    expect(() =>
      adapter.createCollider({ body: b, shape: { kind: 'rect', halfWidth: -1, halfHeight: 1 } }),
    ).toThrow(InvalidParameterError);
    expect(() =>
      adapter.createCollider({ body: b, shape: { kind: 'capsule', halfHeight: -1, radius: 0.2 } }),
    ).toThrow(InvalidParameterError);
    expect(() =>
      adapter.createCollider({
        body: b,
        shape: {
          kind: 'convex',
          vertices: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        },
      }),
    ).toThrow(InvalidParameterError);
    expect(() =>
      adapter.createJoint({
        kind: 'prismatic',
        bodyA: b,
        bodyB: b,
        anchorA: { x: 0, y: 0 },
        anchorB: { x: 0, y: 0 },
        axis: { x: 0, y: 0 },
      }),
    ).toThrow(InvalidParameterError);
    expect(() => adapter.castRay({ x: 0, y: 0 }, { x: 0, y: 0 }, 5)).toThrow(InvalidParameterError);
    expect(() => adapter.castRay({ x: 0, y: 0 }, { x: 1, y: 0 }, -1)).toThrow(
      InvalidParameterError,
    );
    expect(() => adapter.getBodyTransform(99999 as typeof b)).toThrow(InvariantViolationError);

    adapter.free();
  });
});
