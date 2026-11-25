import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { isSimplePolygonConvex } from '../geometry';
import { convexShape } from './convex';

describe('convexShape', () => {
  const diamond = convexShape.params.parse({
    points: [
      { x: 0.4, y: 0 },
      { x: 0, y: 0.2 },
      { x: -0.4, y: 0 },
      { x: 0, y: -0.2 },
    ],
  });

  const concaveArrow = convexShape.params.parse({
    points: [
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: -0.5 },
      { x: 0, y: -0.1 },
      { x: 0.5, y: 0.5 },
      { x: -0.5, y: 0.5 },
    ],
  });

  it('handles convex inputs directly across all strategies', () => {
    expect(convexShape.isConvex(diamond)).toBe(true);
    expect(convexShape.bounds(diamond)).toEqual({ w: 0.8, h: 0.4 });
    expect(convexShape.area(diamond)).toBeCloseTo(0.16);
    expect(convexShape.toColliders(diamond, 'reject')).toHaveLength(1);
    expect(convexShape.scaleParams(diamond, 2).points[0]).toEqual({ x: 0.8, y: 0 });
  });

  it('handles concave inputs according to reject, hull, and decompose strategies', () => {
    expect(convexShape.isConvex(concaveArrow)).toBe(false);
    expect(() => convexShape.toColliders(concaveArrow, 'reject')).toThrow(InvalidParameterError);

    const hullColliders = convexShape.toColliders(concaveArrow, 'hull');
    expect(hullColliders).toHaveLength(1);
    expect(hullColliders[0]?.shape.kind).toBe('convex');
    if (hullColliders[0]?.shape.kind === 'convex') {
      expect(isSimplePolygonConvex(hullColliders[0].shape.vertices)).toBe(true);
    }

    const decomposed = convexShape.toColliders(concaveArrow, 'decompose');
    expect(decomposed).toHaveLength(3);
    for (const col of decomposed) {
      expect(col.shape.kind).toBe('convex');
      if (col.shape.kind === 'convex') {
        expect(isSimplePolygonConvex(col.shape.vertices)).toBe(true);
      }
    }
  });
});
