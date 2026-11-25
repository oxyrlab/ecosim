import { describe, expect, it } from 'vitest';
import { InvalidParameterError, InvariantViolationError } from '@core/index';
import { createMockPhysicsAdapter } from './mock-adapter';

describe('MockPhysicsAdapter', () => {
  it('integrates forces, impulses, torques, and cleans up handles on removal', () => {
    const adapter = createMockPhysicsAdapter();
    const b1 = adapter.createBody({ kind: 'dynamic', position: { x: 0, y: 0 }, linearDamping: 0 });
    const b2 = adapter.createBody({ kind: 'fixed', position: { x: 5, y: 0 } });
    const c1 = adapter.createCollider({ body: b1, shape: { kind: 'circle', radius: 0.5 } });
    const c2 = adapter.createCollider({
      body: b2,
      shape: { kind: 'rect', halfWidth: 1, halfHeight: 1 },
    });
    const j1 = adapter.createJoint({
      kind: 'revolute',
      bodyA: b1,
      bodyB: b2,
      anchorA: { x: 0, y: 0 },
      anchorB: { x: 0, y: 0 },
    });

    expect(adapter.getStats()).toEqual({ bodyCount: 2, colliderCount: 2, jointCount: 1 });

    adapter.applyForce(b1, { x: 10, y: 0 }, { x: 0, y: 1 });
    adapter.applyForce(b1, { x: 2, y: 0 });
    adapter.applyTorque(b1, 2);
    adapter.step(0.5);

    const t1 = adapter.getBodyTransform(b1);
    expect(t1.position.x).toBeGreaterThan(0);
    expect(t1.angle).not.toBe(0);

    adapter.applyImpulse(b1, { x: 0, y: 4 }, { x: 1, y: 0 });
    adapter.applyImpulse(b1, { x: 1, y: 0 });
    adapter.applyImpulse(b2, { x: 10, y: 0 }); // fixed body unaffected
    expect(adapter.getBodyTransform(b2).linearVelocity).toEqual({ x: 0, y: 0 });

    adapter.setBodyTransform(b1, { x: 0, y: 0 }, 0);
    adapter.setBodyVelocity(b1, { x: 0, y: 0 });
    const hit = adapter.castRay({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, b1);
    expect(hit).not.toBeNull();
    expect(hit?.body).toBe(b2);
    expect(hit?.collider).toBe(c2);
    expect(adapter.castRay({ x: 0, y: 0 }, { x: 0, y: 1 }, 10, b1)).toBeNull();
    expect(adapter.castRay({ x: 10, y: 0 }, { x: 1, y: 0 }, 5)).toBeNull();

    adapter.removeCollider(c1);
    adapter.removeJoint(j1);
    adapter.removeBody(b1);
    adapter.removeBody(b2);
    adapter.removeBody(b2); // idempotent
    expect(adapter.getStats()).toEqual({ bodyCount: 0, colliderCount: 0, jointCount: 0 });
    expect(adapter.drainCollisionEvents()).toEqual([]);

    adapter.free();
    expect(() => adapter.step(0.1)).toThrow(InvariantViolationError);
  });

  it('validates invalid arguments and unknown handles', () => {
    const adapter = createMockPhysicsAdapter();
    const b1 = adapter.createBody({ kind: 'dynamic', position: { x: 0, y: 0 } });
    adapter.createCollider({
      body: b1,
      shape: { kind: 'capsule', halfHeight: 0.4, radius: 0.2 },
    });
    adapter.createCollider({
      body: b1,
      shape: {
        kind: 'convex',
        vertices: [
          { x: -0.2, y: -0.2 },
          { x: 0.2, y: -0.2 },
          { x: 0, y: 0.3 },
        ],
      },
    });

    expect(() => adapter.step(0)).toThrow(InvalidParameterError);
    expect(() => adapter.castRay({ x: 0, y: 0 }, { x: 0, y: 0 }, 5)).toThrow(InvalidParameterError);
    expect(() => adapter.castRay({ x: 0, y: 0 }, { x: 1, y: 0 }, -1)).toThrow(
      InvalidParameterError,
    );
    expect(() => adapter.getBodyTransform(999 as typeof b1)).toThrow(InvariantViolationError);

    adapter.free();
  });
});
