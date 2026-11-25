import { describe, expect, it } from 'vitest';
import { triangleShape } from './triangle';

describe('triangleShape', () => {
  it('builds a forward-pointing triangle with convex collider and area', () => {
    const params = triangleShape.params.parse({ w: 0.4, h: 0.2 });
    expect(triangleShape.bounds(params)).toEqual({ w: 0.4, h: 0.2 });
    expect(triangleShape.area(params)).toBeCloseTo(0.04);
    const scaled = triangleShape.scaleParams(params, 3);
    expect(scaled.w).toBeCloseTo(1.2);
    expect(scaled.h).toBeCloseTo(0.6);
    expect(triangleShape.toColliders(params, 'hull')[0]?.shape.kind).toBe('convex');
    expect(() => triangleShape.params.parse({ w: 0, h: 1 })).toThrow();
  });
});
