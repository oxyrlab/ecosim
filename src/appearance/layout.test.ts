import { describe, expect, it } from 'vitest';
import { BlueprintValidationError, InvalidParameterError } from '@core/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { buildPhysicsBodyFromLayout, resolveLayout } from './layout';
import type { BodyPartSpec } from './types';

describe('layout (resolveLayout & buildPhysicsBodyFromLayout)', () => {
  const sampleCreature: BodyPartSpec[] = [
    { id: 'torso', shape: { type: 'ellipse', w: 0.6, h: 0.3 } },
    {
      id: 'head',
      parent: 'torso',
      at: 'front',
      pivot: 'back',
      shape: { type: 'circle', r: 0.15 },
    },
    {
      id: 'ear',
      parent: 'head',
      at: { x: 0.2, y: -0.9 },
      shape: { type: 'triangle', w: 0.08, h: 0.1 },
      joint: 'visual',
      mirror: true,
    },
    {
      id: 'paw',
      parent: 'torso',
      at: { x: -0.5, y: -1 },
      shape: { type: 'capsule', length: 0.1, radius: 0.04 },
      joint: 'visual',
      mirror: true,
      actuator: { instanceId: 'thrust', actuator: 'thruster' },
    },
    {
      id: 'tail',
      parent: 'torso',
      at: 'back',
      pivot: 'front',
      shape: { type: 'capsule', length: 0.2, radius: 0.03 },
      joint: { type: 'revolute', limits: [-0.6, 0.6] },
      anim: [{ kind: 'wag', channel: 'drive.fear', amplitude: 0.4 }],
    },
  ];

  it('resolves relative transforms, mirroring, scaling, physical ancestors, compound bodies, and joints', () => {
    const layout1 = resolveLayout(sampleCreature, 1);
    const layout2 = resolveLayout(sampleCreature, 2);

    // Head attaches front of torso (x=0.3) with back pivot (x=-0.15) -> center at x=0.45
    const head1 = layout1.byId.get('head');
    const head2 = layout2.byId.get('head');
    expect(head1?.position.x).toBeCloseTo(0.45);
    expect(head1?.position.y).toBeCloseTo(0);
    expect(head2?.position.x).toBeCloseTo(0.9);

    // Mirrored visual ears sit symmetrically across Y=0 and have 0 colliders / 0 mass
    const earL = layout1.byId.get('ear.l');
    const earR = layout1.byId.get('ear.r');
    expect(earL?.isVisual).toBe(true);
    expect(earL?.colliders).toEqual([]);
    expect(earL?.mass).toBe(0);
    expect(earL?.physicalAncestorId).toBe('head');
    expect(earL?.position.y).toBeCloseTo(-(earR?.position.y ?? 0));

    // Visual paws route force to nearest physical ancestor ('torso')
    expect(layout1.byId.get('paw.l')?.physicalAncestorId).toBe('torso');
    expect(layout1.byId.get('paw.r')?.physicalAncestorId).toBe('torso');

    // Compound groups: torso+head share 1 rigid body; revolute tail gets 2nd rigid body
    expect(layout1.rigidBodyGroups).toHaveLength(2);
    expect(layout1.rigidBodyGroups[0]?.partIds).toEqual(['torso', 'head']);
    expect(layout1.rigidBodyGroups[1]?.partIds).toEqual(['tail']);
    expect(layout1.joints).toHaveLength(1);
    expect(layout1.joints[0]?.type).toBe('revolute');

    // Deterministic signature changes when scale changes
    expect(layout1.appearanceSignature).toBe(resolveLayout(sampleCreature, 1).appearanceSignature);
    expect(layout1.appearanceSignature).not.toBe(layout2.appearanceSignature);
    expect(layout1.overallBounds.w).toBeGreaterThan(0.8);
  });

  it('builds compound bodies and joints in PhysicsAdapter and cleans them up cleanly', () => {
    const adapter = createMockPhysicsAdapter();
    const layout = resolveLayout(sampleCreature, 1);
    const built = buildPhysicsBodyFromLayout(layout, adapter, { x: 5, y: 5 }, Math.PI / 4);

    expect(built.bodies).toHaveLength(2);
    expect(built.colliders).toHaveLength(3); // torso, head, tail (ears & paws are visual)
    expect(built.joints).toHaveLength(1);
    expect(adapter.getStats()).toEqual({ bodyCount: 2, colliderCount: 3, jointCount: 1 });

    built.removeAll();
    expect(adapter.getStats()).toEqual({ bodyCount: 0, colliderCount: 0, jointCount: 0 });
    adapter.free();
  });

  it('rejects non-positive scale, invalid shape params, and all-visual layouts in physics build', () => {
    expect(() => resolveLayout(sampleCreature, 0)).toThrow(InvalidParameterError);
    expect(() => resolveLayout([{ id: 'bad', shape: { type: 'circle', r: -1 } }])).toThrow(
      BlueprintValidationError,
    );

    const visualOnly = resolveLayout([
      { id: 'ghost', shape: { type: 'circle', r: 0.2 }, joint: 'visual' },
    ]);
    const adapter = createMockPhysicsAdapter();
    expect(() => buildPhysicsBodyFromLayout(visualOnly, adapter, { x: 0, y: 0 })).toThrow(
      BlueprintValidationError,
    );
    adapter.free();
  });
});
