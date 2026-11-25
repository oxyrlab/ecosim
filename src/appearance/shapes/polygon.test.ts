import { describe, expect, it } from 'vitest';
import { polygonShape } from './polygon';

describe('polygonShape', () => {
  it('computes hexagon bounds, path, collider, and area', () => {
    const hex = polygonShape.params.parse({ sides: 6, r: 1 });
    const bounds = polygonShape.bounds(hex);
    expect(bounds.w).toBeCloseTo(2);
    expect(bounds.h).toBeCloseTo(Math.sqrt(3));
    expect(polygonShape.area(hex)).toBeCloseTo((3 * Math.sqrt(3)) / 2);
    expect(polygonShape.scaleParams(hex, 0.5)).toEqual({ sides: 6, r: 0.5 });
    expect(() => polygonShape.params.parse({ sides: 2, r: 1 })).toThrow();
  });
});
