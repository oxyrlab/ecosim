import { describe, expect, it } from 'vitest';
import { circleShape } from './circle';

describe('circleShape', () => {
  it('computes bounds, path, collider, scaling, and area', () => {
    const params = circleShape.params.parse({ r: 0.5 });
    expect(circleShape.bounds(params)).toEqual({ w: 1, h: 1 });
    expect(circleShape.isConvex(params)).toBe(true);
    expect(circleShape.toColliders(params, 'hull')).toEqual([
      { shape: { kind: 'circle', radius: 0.5 } },
    ]);
    expect(circleShape.scaleParams(params, 2)).toEqual({ r: 1 });
    expect(circleShape.area(params)).toBeCloseTo(Math.PI * 0.25);
    expect(() => circleShape.params.parse({ r: 0 })).toThrow();
  });
});
