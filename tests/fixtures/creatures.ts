import { chain, type BodyPartSpec } from '@appearance/index';
import type { BlueprintBodySubject } from '@rules/index';

/**
 * Reference rigid-compound creature fixture ("cat") per Section 5.10 & Section 9.4:
 * - Physical compound root: `torso` (ellipse) + `head` (circle, fixed) -> 1 rigid body, 2 colliders
 * - Visual mirrored details: `ear.l` / `ear.r` (visual triangles), `paw.l` / `paw.r` (visual capsules with mirrored actuators)
 * - Articulated appendage: `tail` (revolute capsule with wag animation) -> 2nd rigid body, 1 collider, 1 joint
 * Total: 7 expanded parts, 2 rigid bodies, 3 colliders, 1 revolute joint.
 */
export const CAT_BODY_PARTS: readonly BodyPartSpec[] = [
  {
    id: 'torso',
    z: 1,
    shape: { type: 'ellipse', w: 0.6, h: 0.3 },
    style: { fill: { h: 30, s: 0.6, l: 0.5 }, pattern: 'stripes' },
  },
  {
    id: 'head',
    parent: 'torso',
    at: 'front',
    pivot: 'back',
    z: 2,
    shape: { type: 'circle', r: 0.14 },
    style: { fill: { h: 30, s: 0.6, l: 0.55 } },
    sensors: [{ instanceId: 'eyes', sensor: 'vision-sensor' }],
  },
  {
    id: 'ear',
    parent: 'head',
    at: { x: 0.25, y: -0.9 },
    angle: -0.3,
    z: 3,
    joint: 'visual',
    mirror: true,
    shape: { type: 'triangle', w: 0.08, h: 0.1 },
    style: { fill: { h: 25, s: 0.5, l: 0.4 } },
  },
  {
    id: 'paw',
    parent: 'torso',
    at: { x: -0.4, y: -0.95 },
    z: 0,
    joint: 'visual',
    mirror: true,
    shape: { type: 'capsule', length: 0.1, radius: 0.04 },
    actuator: { instanceId: 'thrust', actuator: 'thruster' },
    anim: [{ kind: 'swing', channel: '$actuator:power', amplitude: 0.35 }],
  },
  {
    id: 'tail',
    parent: 'torso',
    at: 'back',
    pivot: 'front',
    z: 0,
    shape: { type: 'capsule', length: 0.28, radius: 0.045 },
    massDensity: 1.5,
    joint: { type: 'revolute', limits: [-0.6, 0.6] },
    anim: [{ kind: 'wag', channel: 'drive.fear', amplitude: 0.4 }],
  },
];

/** Blueprint-shaped wrapper for {@link CAT_BODY_PARTS}. */
export const CAT_BODY_FIXTURE: BlueprintBodySubject = {
  body: { parts: CAT_BODY_PARTS },
};

/**
 * Reference jointed-chain creature fixture ("worm") per Section 5.10 & Section 9.4:
 * - 5 tapered capsule segments connected via revolute joints.
 * Total: 5 expanded parts, 5 rigid bodies, 5 colliders, 4 revolute joints.
 */
export const WORM_BODY_PARTS: readonly BodyPartSpec[] = chain({
  count: 5,
  idPrefix: 'seg',
  shape: (i) => ({
    type: 'capsule',
    length: 0.16,
    radius: 0.07 - i * 0.006,
  }),
  joint: { type: 'revolute', limits: [-0.5, 0.5] },
  style: (i) => ({
    fill: { h: 350, s: 0.55, l: 0.55 - i * 0.03 },
  }),
});

/** Blueprint-shaped wrapper for {@link WORM_BODY_PARTS}. */
export const WORM_BODY_FIXTURE: BlueprintBodySubject = {
  body: { parts: WORM_BODY_PARTS },
};

/**
 * Concave arrow fixture used to verify `ConcaveStrategy` (`reject`, `hull`, `decompose`).
 */
export const CONCAVE_ARROW_BODY_FIXTURE: BlueprintBodySubject = {
  body: {
    parts: [
      {
        id: 'arrow',
        shape: {
          type: 'convex',
          points: [
            { x: -0.4, y: -0.3 },
            { x: 0.4, y: -0.3 },
            { x: 0, y: -0.05 },
            { x: 0.4, y: 0.3 },
            { x: -0.4, y: 0.3 },
          ],
        },
      },
    ],
  },
};
