import { z } from 'zod';
import { InvalidParameterError, type Vec2 } from '@core/index';
import {
  computeConvexHull,
  computePointsBounds,
  decomposePolygonToTriangles,
  isSimplePolygonConvex,
  signedPolygonArea,
} from '../geometry';
import {
  defineShape,
  type ConcaveStrategy,
  type PathCommand,
  type ShapeColliderSpec,
} from './shape-def';

const vec2Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

/** Parameter schema for the `convex` arbitrary-polygon primitive shape (points in meters). */
export const convexParamsSchema = z.object({
  points: z.array(vec2Schema).min(3),
});

/** Validated parameters for the `convex` shape. */
export type ConvexParams = z.infer<typeof convexParamsSchema>;

/**
 * Primitive `convex` shape defined by arbitrary ordered vertices (meters).
 * When given concave points, `isConvex()` returns `false` and `toColliders()` resolves them
 * according to the active `ConcaveStrategy` (`reject`, `hull`, or `decompose`).
 */
export const convexShape = defineShape({
  id: 'convex',
  description:
    'Polygon defined by arbitrary vertices (meters); non-convex inputs follow ConcaveStrategy.',
  params: convexParamsSchema,
  bounds(params) {
    return computePointsBounds(params.points);
  },
  toPath(params): readonly PathCommand[] {
    const cmds: PathCommand[] = [];
    for (let i = 0; i < params.points.length; i += 1) {
      const p = params.points[i] as Vec2;
      cmds.push(i === 0 ? { kind: 'moveTo', x: p.x, y: p.y } : { kind: 'lineTo', x: p.x, y: p.y });
    }
    cmds.push({ kind: 'closePath' });
    return cmds;
  },
  toColliders(params, strategy: ConcaveStrategy): readonly ShapeColliderSpec[] {
    if (isSimplePolygonConvex(params.points)) {
      return [{ shape: { kind: 'convex', vertices: [...params.points] } }];
    }
    if (strategy === 'reject') {
      throw new InvalidParameterError(
        'points',
        params.points,
        'convex polygon vertices (ConcaveStrategy is "reject")',
        'convexShape.toColliders',
      );
    }
    if (strategy === 'hull') {
      return [{ shape: { kind: 'convex', vertices: computeConvexHull(params.points) } }];
    }
    return decomposePolygonToTriangles(params.points).map((tri) => ({
      shape: { kind: 'convex', vertices: tri },
    }));
  },
  isConvex(params) {
    return isSimplePolygonConvex(params.points);
  },
  scaleParams(params, scaleFactor) {
    return {
      points: params.points.map((p) => ({ x: p.x * scaleFactor, y: p.y * scaleFactor })),
    };
  },
  area(params) {
    return Math.abs(signedPolygonArea(params.points));
  },
});
