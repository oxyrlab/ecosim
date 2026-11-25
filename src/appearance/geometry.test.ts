import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import {
  computeConvexHull,
  computePointsBounds,
  decomposePolygonToTriangles,
  isSimplePolygonConvex,
  signedPolygonArea,
} from './geometry';

describe('appearance geometry helpers', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 0, y: 2 },
  ];
  const arrow = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 0.4 }, // concave reflex vertex
    { x: 2, y: 2 },
    { x: 0, y: 2 },
  ];

  it('computes signed area, bounds, and convexity', () => {
    expect(signedPolygonArea(square)).toBeCloseTo(4);
    expect(signedPolygonArea([...square].reverse())).toBeCloseTo(-4);
    expect(signedPolygonArea([{ x: 0, y: 0 }])).toBe(0);

    expect(computePointsBounds(square)).toEqual({ w: 2, h: 2 });
    expect(() => computePointsBounds([])).toThrow(InvalidParameterError);

    expect(isSimplePolygonConvex(square)).toBe(true);
    expect(isSimplePolygonConvex([...square].reverse())).toBe(true);
    expect(isSimplePolygonConvex(arrow)).toBe(false);
    expect(
      isSimplePolygonConvex([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toBe(false);
    expect(
      isSimplePolygonConvex([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ).toBe(false);
  });

  it('computes convex hull for concave point sets and rejects collinear input', () => {
    const hull = computeConvexHull(arrow);
    expect(hull).toHaveLength(4);
    expect(isSimplePolygonConvex(hull)).toBe(true);
    expect(signedPolygonArea(hull)).toBeCloseTo(4);

    expect(() =>
      computeConvexHull([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toThrow(InvalidParameterError);
    expect(() =>
      computeConvexHull([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]),
    ).toThrow(InvalidParameterError);
  });

  it('decomposes concave polygons into convex triangles preserving total area', () => {
    const tris = decomposePolygonToTriangles(arrow);
    expect(tris.length).toBe(arrow.length - 2);
    let totalArea = 0;
    for (const tri of tris) {
      expect(tri).toHaveLength(3);
      expect(isSimplePolygonConvex(tri)).toBe(true);
      totalArea += signedPolygonArea(tri);
    }
    expect(totalArea).toBeCloseTo(signedPolygonArea(arrow));

    // Also handles clockwise input
    const cwTris = decomposePolygonToTriangles([...arrow].reverse());
    expect(cwTris.length).toBe(arrow.length - 2);

    expect(() => decomposePolygonToTriangles([{ x: 0, y: 0 }])).toThrow(InvalidParameterError);
    expect(() =>
      decomposePolygonToTriangles([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ).toThrow(InvalidParameterError);
  });
});
