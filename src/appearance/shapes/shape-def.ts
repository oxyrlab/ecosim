import {
  assertKebabCaseId,
  createRegistry,
  InvalidParameterError,
  type ComponentMeta,
  type Registry,
  type Vec2,
} from '@core/index';
import type { ColliderShapeDesc } from '@physics/types';
import type { Bounds2D } from '../geometry';

/**
 * Policy applied when converting a concave shape into convex Rapier colliders
 * (configured via Rule `collider-concave-strategy`).
 */
export type ConcaveStrategy = 'reject' | 'hull' | 'decompose';

/**
 * Renderer-agnostic 2D vector path instruction emitted by {@link ShapeDef.toPath}.
 */
export type PathCommand =
  | { readonly kind: 'moveTo'; readonly x: number; readonly y: number }
  | { readonly kind: 'lineTo'; readonly x: number; readonly y: number }
  | {
      readonly kind: 'arc';
      readonly cx: number;
      readonly cy: number;
      readonly radius: number;
      readonly startAngle: number;
      readonly endAngle: number;
    }
  | { readonly kind: 'closePath' };

/**
 * Single convex physics collider produced from a shape, with optional local offset/rotation.
 */
export interface ShapeColliderSpec {
  /** Convex collider geometry in meters. */
  readonly shape: ColliderShapeDesc;
  /** Optional local offset relative to the part center in meters. */
  readonly offset?: Vec2;
  /** Optional local rotation relative to the part orientation in radians. */
  readonly angle?: number;
}

/**
 * Self-describing definition of a primitive shape registered in {@link shapeRegistry}.
 *
 * @typeParam P - Validated parameter type produced by `params`.
 */
export interface ShapeDef<P> extends ComponentMeta<P> {
  /** Returns axis-aligned bounding width and height in meters. */
  bounds(params: P): Bounds2D;
  /** Returns closed 2D path commands in local part space (meters, zero Pixi dependency). */
  toPath(params: P): readonly PathCommand[];
  /** Converts the shape into one or more convex {@link ShapeColliderSpec}s. */
  toColliders(params: P, strategy: ConcaveStrategy): readonly ShapeColliderSpec[];
  /** Returns `true` when the shape with `params` is convex. */
  isConvex(params: P): boolean;
  /** Returns scaled parameters for growth (`scaleFactor > 0`). */
  scaleParams(params: P, scaleFactor: number): P;
  /** Returns the geometric area in square meters (used to compute part mass from density). */
  area(params: P): number;
}

/**
 * Global registry of primitive shape definitions.
 */
export const shapeRegistry: Registry<ShapeDef<unknown>> =
  createRegistry<ShapeDef<unknown>>('shape');

/**
 * Identity helper inferring parameter types for a {@link ShapeDef} while validating metadata.
 */
export function defineShape<P>(def: ShapeDef<P>): ShapeDef<P> {
  assertKebabCaseId(def.id, 'shape id');
  if (def.description.trim().length === 0) {
    throw new InvalidParameterError(
      'description',
      def.description,
      'a non-empty shape description',
      `defineShape(${def.id})`,
    );
  }
  return def;
}

/**
 * Registers a {@link ShapeDef} into a shape registry (defaults to {@link shapeRegistry}).
 */
export function registerShape<P>(
  def: ShapeDef<P>,
  registry: Registry<ShapeDef<unknown>> = shapeRegistry,
): ShapeDef<P> {
  defineShape(def);
  registry.register(def as ShapeDef<unknown>);
  return def;
}
