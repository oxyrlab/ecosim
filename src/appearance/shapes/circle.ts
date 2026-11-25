import { z } from 'zod';
import { defineShape, type PathCommand } from './shape-def';

/** Parameter schema for the `circle` primitive shape. */
export const circleParamsSchema = z.object({
  r: z.number().finite().positive(),
});

/** Validated parameters for the `circle` shape (`r` in meters). */
export type CircleParams = z.infer<typeof circleParamsSchema>;

/**
 * Primitive `circle` shape centered at `(0, 0)` with radius `r` (meters).
 */
export const circleShape = defineShape({
  id: 'circle',
  description: 'Circular silhouette centered at the origin with radius r (meters).',
  params: circleParamsSchema,
  bounds(params) {
    return { w: params.r * 2, h: params.r * 2 };
  },
  toPath(params): readonly PathCommand[] {
    return [
      { kind: 'moveTo', x: params.r, y: 0 },
      { kind: 'arc', cx: 0, cy: 0, radius: params.r, startAngle: 0, endAngle: Math.PI * 2 },
      { kind: 'closePath' },
    ];
  },
  toColliders(params) {
    return [{ shape: { kind: 'circle', radius: params.r } }];
  },
  isConvex() {
    return true;
  },
  scaleParams(params, scaleFactor) {
    return { r: params.r * scaleFactor };
  },
  area(params) {
    return Math.PI * params.r * params.r;
  },
});
