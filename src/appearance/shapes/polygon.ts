import { z } from 'zod';
import type { Vec2 } from '@core/index';
import { computePointsBounds } from '../geometry';
import { defineShape, type PathCommand } from './shape-def';

/** Parameter schema for the regular `polygon` primitive shape (`sides >= 3`, circumradius `r` in meters). */
export const polygonParamsSchema = z.object({
  sides: z.number().int().min(3),
  r: z.number().finite().positive(),
});

/** Validated parameters for the regular `polygon` shape. */
export type PolygonParams = z.infer<typeof polygonParamsSchema>;

function regularPolygonVertices(params: PolygonParams): Vec2[] {
  const vertices: Vec2[] = [];
  for (let i = 0; i < params.sides; i += 1) {
    const theta = (i / params.sides) * Math.PI * 2;
    vertices.push({ x: Math.cos(theta) * params.r, y: Math.sin(theta) * params.r });
  }
  return vertices;
}

/**
 * Primitive regular convex `polygon` centered at `(0, 0)` with `sides` vertices and radius `r` (meters).
 */
export const polygonShape = defineShape({
  id: 'polygon',
  description: 'Regular convex polygon with N sides (>= 3) and circumradius r (meters).',
  params: polygonParamsSchema,
  bounds(params) {
    return computePointsBounds(regularPolygonVertices(params));
  },
  toPath(params): readonly PathCommand[] {
    const pts = regularPolygonVertices(params);
    const cmds: PathCommand[] = [];
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i] as Vec2;
      cmds.push(i === 0 ? { kind: 'moveTo', x: p.x, y: p.y } : { kind: 'lineTo', x: p.x, y: p.y });
    }
    cmds.push({ kind: 'closePath' });
    return cmds;
  },
  toColliders(params) {
    return [{ shape: { kind: 'convex', vertices: regularPolygonVertices(params) } }];
  },
  isConvex() {
    return true;
  },
  scaleParams(params, scaleFactor) {
    return { sides: params.sides, r: params.r * scaleFactor };
  },
  area(params) {
    return 0.5 * params.sides * params.r * params.r * Math.sin((Math.PI * 2) / params.sides);
  },
});
