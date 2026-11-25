import { InvalidParameterError } from './errors';
import { assertFiniteNumber } from './types';

/**
 * Immutable 2D Cartesian vector in SI meters (or dimensionless direction).
 */
export interface Vec2 {
  /** Horizontal coordinate in meters. */
  readonly x: number;
  /** Vertical coordinate in meters. */
  readonly y: number;
}

/**
 * Constant zero vector `(0, 0)`.
 */
export const ZERO_VEC2: Vec2 = Object.freeze({ x: 0, y: 0 });

/**
 * Constructs an immutable {@link Vec2}.
 *
 * @param x - Horizontal component.
 * @param y - Vertical component.
 * @returns New {@link Vec2} object.
 */
export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

/**
 * Validates that both components of a vector are finite numbers.
 *
 * @param name - Name of the vector for error reporting.
 * @param v - Vector to validate.
 * @param context - Optional location context.
 * @returns The validated vector unchanged.
 * @throws InvalidParameterError if `v.x` or `v.y` is `NaN` or infinite.
 */
export function assertFiniteVec2(name: string, v: Vec2, context?: string): Vec2 {
  assertFiniteNumber(`${name}.x`, v.x, context);
  assertFiniteNumber(`${name}.y`, v.y, context);
  return v;
}

/**
 * Adds two vectors: `a + b`.
 *
 * @param a - First vector.
 * @param b - Second vector.
 * @returns Component-wise sum.
 */
export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * Subtracts vector `b` from vector `a`: `a - b`.
 *
 * @param a - Minuend vector.
 * @param b - Subtrahend vector.
 * @returns Component-wise difference.
 */
export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * Scales a vector by a scalar factor.
 *
 * @param v - Input vector.
 * @param factor - Scalar multiplier.
 * @returns Scaled vector.
 */
export function scale(v: Vec2, factor: number): Vec2 {
  return { x: v.x * factor, y: v.y * factor };
}

/**
 * Negates a vector: `(-v.x, -v.y)`.
 *
 * @param v - Input vector.
 * @returns Negated vector.
 */
export function negate(v: Vec2): Vec2 {
  return { x: -v.x, y: -v.y };
}

/**
 * Computes the dot product `a · b`.
 *
 * @param a - First vector.
 * @param b - Second vector.
 * @returns Scalar dot product.
 */
export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Computes the 2D scalar cross product (z-component of 3D cross product): `a.x * b.y - a.y * b.x`.
 *
 * @param a - First vector.
 * @param b - Second vector.
 * @returns Signed area spanned by `a` and `b`.
 */
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

/**
 * Returns the squared Euclidean length of `v` (meters squared).
 *
 * @param v - Input vector.
 * @returns `v.x * v.x + v.y * v.y`.
 */
export function lengthSq(v: Vec2): number {
  return v.x * v.x + v.y * v.y;
}

/**
 * Returns the Euclidean length (magnitude) of `v` in meters.
 *
 * @param v - Input vector.
 * @returns Magnitude >= 0.
 */
export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

/**
 * Returns the squared Euclidean distance between `a` and `b` (meters squared).
 *
 * @param a - First point.
 * @param b - Second point.
 * @returns Squared distance >= 0.
 */
export function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Returns the Euclidean distance between `a` and `b` in meters.
 *
 * @param a - First point.
 * @param b - Second point.
 * @returns Distance >= 0.
 */
export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Returns the unit vector in the direction of `v`, or {@link ZERO_VEC2} if `v` has zero length.
 *
 * @param v - Input vector.
 * @returns Normalized vector of length `1`, or `(0, 0)` when `length(v) === 0`.
 */
export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) return ZERO_VEC2;
  return { x: v.x / len, y: v.y / len };
}

/**
 * Rotates vector `v` counter-clockwise by `radians`.
 *
 * @param v - Input vector.
 * @param radians - Rotation angle in radians.
 * @returns Rotated vector.
 */
export function rotate(v: Vec2, radians: number): Vec2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}

/**
 * Returns the angle of `v` in radians in `[-π, π]` measured from the positive X axis.
 *
 * @param v - Input vector.
 * @returns Angle in radians (`0` for `(0, 0)`).
 */
export function angle(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

/**
 * Constructs a vector from polar coordinates `(radians, magnitude)`.
 *
 * @param radians - Angle in radians from the positive X axis.
 * @param magnitude - Vector length in meters (default `1`).
 * @returns Cartesian {@link Vec2}.
 */
export function fromAngle(radians: number, magnitude = 1): Vec2 {
  return {
    x: Math.cos(radians) * magnitude,
    y: Math.sin(radians) * magnitude,
  };
}

/**
 * Linearly interpolates between `a` and `b` by parameter `t` (`0` returns `a`, `1` returns `b`).
 *
 * @param a - Start vector.
 * @param b - End vector.
 * @param t - Interpolation parameter.
 * @returns Interpolated vector.
 */
export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * Caps the magnitude of `v` to at most `maxLength` meters while preserving direction.
 *
 * @param v - Input vector.
 * @param maxLength - Maximum allowed length in meters (must be finite and >= 0).
 * @returns `v` if `length(v) <= maxLength`, otherwise a vector in the same direction with length `maxLength`.
 * @throws InvalidParameterError if `maxLength` is negative or non-finite.
 */
export function clampLength(v: Vec2, maxLength: number): Vec2 {
  if (!Number.isFinite(maxLength) || maxLength < 0) {
    throw new InvalidParameterError('maxLength', maxLength, 'a finite number >= 0', 'clampLength');
  }
  const len = Math.hypot(v.x, v.y);
  if (len <= maxLength || len === 0) return v;
  const factor = maxLength / len;
  return { x: v.x * factor, y: v.y * factor };
}

/**
 * Compares two vectors for approximate equality within `epsilon` per component.
 *
 * @param a - First vector.
 * @param b - Second vector.
 * @param epsilon - Non-negative per-component tolerance (default `1e-9`).
 * @returns `true` if `|a.x - b.x| <= epsilon` and `|a.y - b.y| <= epsilon`.
 */
export function equals(a: Vec2, b: Vec2, epsilon = 1e-9): boolean {
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}
