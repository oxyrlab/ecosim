import { z } from 'zod';
import type { Vec2 } from '@core/index';
import { defineShape, type PathCommand } from './shape-def';

/** Parameter schema for the `ellipse` primitive shape (`w` along X, `h` along Y in meters). */
export const ellipseParamsSchema = z.object({
  w: z.number().finite().positive(),
  h: z.number().finite().positive(),
});

/** Validated parameters for the `ellipse` shape. */
export type EllipseParams = z.infer<typeof ellipseParamsSchema>;

const ELLIPSE_COLLIDER_SEGMENTS = 12;
const ELLIPSE_PATH_SEGMENTS = 24;

function sampleEllipseVertices(w: number, h: number, segments: number): Vec2[] {
  const rx = w * 0.5;
  const ry = h * 0.5;
  const pts: Vec2[] = [];
  for (let i = 0; i < segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    pts.push({ x: Math.cos(theta) * rx, y: Math.sin(theta) * ry });
  }
  return pts;
}

/**
 * Primitive `ellipse` shape centered at `(0, 0)` with total width `w` (X) and height `h` (Y) in meters.
 */
export const ellipseShape = defineShape({
  id: 'ellipse',
  description: 'Elliptical silhouette centered at the origin with width w and height h (meters).',
  params: ellipseParamsSchema,
  bounds(params) {
    return { w: params.w, h: params.h };
  },
  toPath(params): readonly PathCommand[] {
    const pts = sampleEllipseVertices(params.w, params.h, ELLIPSE_PATH_SEGMENTS);
    const cmds: PathCommand[] = [];
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i] as Vec2;
      cmds.push(i === 0 ? { kind: 'moveTo', x: p.x, y: p.y } : { kind: 'lineTo', x: p.x, y: p.y });
    }
    cmds.push({ kind: 'closePath' });
    return cmds;
  },
  toColliders(params) {
    if (Math.abs(params.w - params.h) <= 1e-6) {
      return [{ shape: { kind: 'circle', radius: params.w * 0.5 } }];
    }
    return [
      {
        shape: {
          kind: 'convex',
          vertices: sampleEllipseVertices(params.w, params.h, ELLIPSE_COLLIDER_SEGMENTS),
        },
      },
    ];
  },
  isConvex() {
    return true;
  },
  scaleParams(params, scaleFactor) {
    return { w: params.w * scaleFactor, h: params.h * scaleFactor };
  },
  area(params) {
    return Math.PI * (params.w * 0.5) * (params.h * 0.5);
  },
});
