import { z } from 'zod';
import { defineShape, type PathCommand } from './shape-def';

/**
 * Parameter schema for the `capsule` primitive shape oriented horizontally along the local X axis.
 * `length` is the straight middle segment length between hemisphere centers (meters);
 * total width is `length + 2 * radius` and total height is `2 * radius`.
 */
export const capsuleParamsSchema = z.object({
  length: z.number().finite().nonnegative(),
  radius: z.number().finite().positive(),
});

/** Validated parameters for the `capsule` shape. */
export type CapsuleParams = z.infer<typeof capsuleParamsSchema>;

/**
 * Primitive `capsule` shape aligned with the local X axis (front/back).
 * Rapier's native capsule aligns with Y, so the collider is rotated by `π/2` radians.
 */
export const capsuleShape = defineShape({
  id: 'capsule',
  description:
    'Horizontal stadium/capsule along local X with segment length and end radius (meters).',
  params: capsuleParamsSchema,
  bounds(params) {
    return { w: params.length + params.radius * 2, h: params.radius * 2 };
  },
  toPath(params): readonly PathCommand[] {
    const halfLen = params.length * 0.5;
    const r = params.radius;
    return [
      { kind: 'moveTo', x: -halfLen, y: -r },
      { kind: 'lineTo', x: halfLen, y: -r },
      {
        kind: 'arc',
        cx: halfLen,
        cy: 0,
        radius: r,
        startAngle: -Math.PI / 2,
        endAngle: Math.PI / 2,
      },
      { kind: 'lineTo', x: -halfLen, y: r },
      {
        kind: 'arc',
        cx: -halfLen,
        cy: 0,
        radius: r,
        startAngle: Math.PI / 2,
        endAngle: (3 * Math.PI) / 2,
      },
      { kind: 'closePath' },
    ];
  },
  toColliders(params) {
    return [
      {
        shape: { kind: 'capsule', halfHeight: params.length * 0.5, radius: params.radius },
        angle: Math.PI / 2,
      },
    ];
  },
  isConvex() {
    return true;
  },
  scaleParams(params, scaleFactor) {
    return { length: params.length * scaleFactor, radius: params.radius * scaleFactor };
  },
  area(params) {
    return params.length * (params.radius * 2) + Math.PI * params.radius * params.radius;
  },
});
