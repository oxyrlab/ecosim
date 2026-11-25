import { describe, expect, it } from 'vitest';
import { ellipseShape } from './ellipse';

describe('ellipseShape', () => {
  it('produces convex polygon collider for non-circular ellipses and circle for equal axes', () => {
    const oval = ellipseShape.params.parse({ w: 0.6, h: 0.3 });
    expect(ellipseShape.bounds(oval)).toEqual({ w: 0.6, h: 0.3 });
    expect(ellipseShape.isConvex(oval)).toBe(true);
    expect(ellipseShape.toColliders(oval, 'hull')[0]?.shape.kind).toBe('convex');
    expect(ellipseShape.scaleParams(oval, 2)).toEqual({ w: 1.2, h: 0.6 });
    expect(ellipseShape.area(oval)).toBeCloseTo(Math.PI * 0.3 * 0.15);

    const round = ellipseShape.params.parse({ w: 0.4, h: 0.4 });
    expect(ellipseShape.toColliders(round, 'hull')[0]?.shape.kind).toBe('circle');
    expect(() => ellipseShape.params.parse({ w: -1, h: 1 })).toThrow();
  });
});
