import { z } from 'zod';
import type { Vec2 } from '@core/index';
import { defineShape, type PathCommand } from './shape-def';

/** Parameter schema for the `triangle` primitive shape (`w` length along X, `h` base along Y). */
export const triangleParamsSchema = z.object({
  w: z.number().finite().positive(),
  h: z.number().finite().positive(),
});

/** Validated parameters for the `triangle` shape. */
export type TriangleParams = z.infer<typeof triangleParamsSchema>;

function triangleVertices(params: TriangleParams): readonly Vec2[] {
  const hw = params.w * 0.5;
  const hh = params.h * 0.5;
  return [
    { x: hw, y: 0 },
    { x: -hw, y: hh },
    { x: -hw, y: -hh },
  ];
}

/**
 * Primitive isosceles `triangle` pointing forward along `+X` with length `w` and base `h` (meters).
 */
export const triangleShape = defineShape({
  id: 'triangle',
  description: 'Isosceles triangle pointing along +X with length w and base width h (meters).',
  params: triangleParamsSchema,
  bounds(params) {
    return { w: params.w, h: params.h };
  },
  toPath(params): readonly PathCommand[] {
    const [tip, bottomLeft, topLeft] = triangleVertices(params) as [Vec2, Vec2, Vec2];
    return [
      { kind: 'moveTo', x: tip.x, y: tip.y },
      { kind: 'lineTo', x: bottomLeft.x, y: bottomLeft.y },
      { kind: 'lineTo', x: topLeft.x, y: topLeft.y },
      { kind: 'closePath' },
    ];
  },
  toColliders(params) {
    return [{ shape: { kind: 'convex', vertices: triangleVertices(params) } }];
  },
  isConvex() {
    return true;
  },
  scaleParams(params, scaleFactor) {
    return { w: params.w * scaleFactor, h: params.h * scaleFactor };
  },
  area(params) {
    return 0.5 * params.w * params.h;
  },
});
