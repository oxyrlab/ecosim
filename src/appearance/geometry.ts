import { InvalidParameterError, type Vec2 } from '@core/index';

/**
 * Axis-aligned 2D bounding box width and height in SI meters.
 */
export interface Bounds2D {
  /** Total horizontal extent in meters (> 0). */
  readonly w: number;
  /** Total vertical extent in meters (> 0). */
  readonly h: number;
}

/**
 * Computes the signed area of a simple polygon (positive for counter-clockwise winding).
 *
 * @param points - Ordered polygon vertices in meters.
 * @returns Signed area in square meters.
 */
export function signedPolygonArea(points: readonly Vec2[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i] as Vec2;
    const b = points[(i + 1) % points.length] as Vec2;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum * 0.5;
}

/**
 * Returns the axis-aligned width and height covering `points` in meters.
 */
export function computePointsBounds(points: readonly Vec2[]): Bounds2D {
  if (points.length === 0) {
    throw new InvalidParameterError(
      'points',
      points,
      'a non-empty array of Vec2',
      'computePointsBounds',
    );
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { w: maxX - minX, h: maxY - minY };
}

function cross2(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Checks whether an ordered polygon of at least 3 vertices is strictly convex (all turns have
 * consistent non-reversing orientation and non-zero area).
 */
export function isSimplePolygonConvex(points: readonly Vec2[]): boolean {
  if (points.length < 3) return false;
  if (Math.abs(signedPolygonArea(points)) < 1e-10) return false;

  let sign = 0;
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const a = points[i] as Vec2;
    const b = points[(i + 1) % n] as Vec2;
    const c = points[(i + 2) % n] as Vec2;
    const z = cross2(a, b, c);
    if (Math.abs(z) <= 1e-10) continue;
    const currentSign = z > 0 ? 1 : -1;
    if (sign === 0) {
      sign = currentSign;
    } else if (sign !== currentSign) {
      return false;
    }
  }
  return sign !== 0;
}

/**
 * Computes the counter-clockwise 2D convex hull of a point set using Andrew's monotonic chain
 * algorithm.
 *
 * @param points - Input vertices in meters (must contain at least 3 non-collinear points).
 * @returns Counter-clockwise convex hull vertices without duplicate endpoints.
 * @throws InvalidParameterError if points are collinear or fewer than 3 unique hull vertices exist.
 */
export function computeConvexHull(points: readonly Vec2[]): Vec2[] {
  if (points.length < 3) {
    throw new InvalidParameterError(
      'points',
      points.length,
      'at least 3 vertices',
      'computeConvexHull',
    );
  }

  const sorted = [...points].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const lower: Vec2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2) {
      const o = lower[lower.length - 2] as Vec2;
      const a = lower[lower.length - 1] as Vec2;
      if (cross2(o, a, p) <= 1e-12) {
        lower.pop();
      } else {
        break;
      }
    }
    lower.push(p);
  }

  const upper: Vec2[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const p = sorted[i] as Vec2;
    while (upper.length >= 2) {
      const o = upper[upper.length - 2] as Vec2;
      const a = upper[upper.length - 1] as Vec2;
      if (cross2(o, a, p) <= 1e-12) {
        upper.pop();
      } else {
        break;
      }
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  const hull = lower.concat(upper);
  if (hull.length < 3 || Math.abs(signedPolygonArea(hull)) < 1e-10) {
    throw new InvalidParameterError(
      'points',
      points,
      'non-collinear vertices forming a non-degenerate convex hull',
      'computeConvexHull',
    );
  }
  return hull;
}

function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const c1 = cross2(a, b, p);
  const c2 = cross2(b, c, p);
  const c3 = cross2(c, a, p);
  return c1 >= -1e-10 && c2 >= -1e-10 && c3 >= -1e-10;
}

/**
 * Decomposes a simple (possibly concave) polygon into counter-clockwise convex triangles using
 * deterministic ear clipping.
 *
 * @param points - Ordered simple polygon vertices in meters.
 * @returns Array of counter-clockwise 3-vertex triangles whose union equals the polygon.
 * @throws InvalidParameterError if the polygon has fewer than 3 vertices or zero area.
 */
export function decomposePolygonToTriangles(points: readonly Vec2[]): Vec2[][] {
  if (points.length < 3) {
    throw new InvalidParameterError(
      'points',
      points.length,
      'at least 3 vertices',
      'decomposePolygonToTriangles',
    );
  }

  const area = signedPolygonArea(points);
  if (Math.abs(area) < 1e-10) {
    throw new InvalidParameterError(
      'points',
      points,
      'a non-degenerate simple polygon with non-zero area',
      'decomposePolygonToTriangles',
    );
  }

  // Ensure counter-clockwise winding.
  const remaining: Vec2[] = area > 0 ? [...points] : [...points].reverse();
  const triangles: Vec2[][] = [];
  let guard = remaining.length * remaining.length;

  while (remaining.length > 3 && guard > 0) {
    guard -= 1;
    let clipped = false;
    const n = remaining.length;

    for (let i = 0; i < n; i += 1) {
      const prev = remaining[(i + n - 1) % n] as Vec2;
      const curr = remaining[i] as Vec2;
      const next = remaining[(i + 1) % n] as Vec2;

      // Ear must be a convex (CCW) corner.
      if (cross2(prev, curr, next) <= 1e-10) continue;

      let containsOther = false;
      for (let j = 0; j < n; j += 1) {
        if (j === (i + n - 1) % n || j === i || j === (i + 1) % n) continue;
        if (pointInTriangle(remaining[j] as Vec2, prev, curr, next)) {
          containsOther = true;
          break;
        }
      }

      if (!containsOther) {
        triangles.push([prev, curr, next]);
        remaining.splice(i, 1);
        clipped = true;
        break;
      }
    }

    if (!clipped) {
      throw new InvalidParameterError(
        'points',
        points,
        'a non-self-intersecting simple polygon',
        'decomposePolygonToTriangles',
      );
    }
  }

  if (remaining.length === 3) {
    triangles.push([remaining[0] as Vec2, remaining[1] as Vec2, remaining[2] as Vec2]);
  }
  return triangles;
}
