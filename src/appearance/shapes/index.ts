import { circleShape } from './circle';
import { ellipseShape } from './ellipse';
import { rectShape } from './rect';
import { capsuleShape } from './capsule';
import { triangleShape } from './triangle';
import { polygonShape } from './polygon';
import { convexShape } from './convex';
import { registerShape, shapeRegistry, type ShapeDef } from './shape-def';
import type { Registry } from '@core/index';

/**
 * All 7 built-in primitive shape definitions.
 */
export const BUILTIN_SHAPES: readonly ShapeDef<unknown>[] = Object.freeze([
  circleShape as ShapeDef<unknown>,
  ellipseShape as ShapeDef<unknown>,
  rectShape as ShapeDef<unknown>,
  capsuleShape as ShapeDef<unknown>,
  triangleShape as ShapeDef<unknown>,
  polygonShape as ShapeDef<unknown>,
  convexShape as ShapeDef<unknown>,
]);

/**
 * Registers all 7 built-in primitive shapes into `registry` (idempotent if already present).
 */
export function registerBuiltinShapes(registry: Registry<ShapeDef<unknown>> = shapeRegistry): void {
  for (const shape of BUILTIN_SHAPES) {
    if (!registry.has(shape.id)) {
      registerShape(shape, registry);
    }
  }
}

// Register built-in primitive shapes into the global shapeRegistry on module load.
registerBuiltinShapes(shapeRegistry);

export {
  defineShape,
  registerShape,
  shapeRegistry,
  type ConcaveStrategy,
  type PathCommand,
  type ShapeColliderSpec,
  type ShapeDef,
} from './shape-def';
export { circleParamsSchema, circleShape, type CircleParams } from './circle';
export { ellipseParamsSchema, ellipseShape, type EllipseParams } from './ellipse';
export { rectParamsSchema, rectShape, type RectParams } from './rect';
export { capsuleParamsSchema, capsuleShape, type CapsuleParams } from './capsule';
export { triangleParamsSchema, triangleShape, type TriangleParams } from './triangle';
export { polygonParamsSchema, polygonShape, type PolygonParams } from './polygon';
export { convexParamsSchema, convexShape, type ConvexParams } from './convex';
