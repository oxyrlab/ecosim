import { describe, expect, it } from 'vitest';
import { rectShape } from './rect';

describe('rectShape', () => {
  it('supports sharp and rounded rectangles', () => {
    const sharp = rectShape.params.parse({ w: 0.8, h: 0.4 });
    expect(rectShape.bounds(sharp)).toEqual({ w: 0.8, h: 0.4 });
    expect(rectShape.toPath(sharp)).toHaveLength(5);
    expect(rectShape.area(sharp)).toBeCloseTo(0.32);
    expect(rectShape.scaleParams(sharp, 0.5)).toEqual({ w: 0.4, h: 0.2 });

    const rounded = rectShape.params.parse({ w: 0.8, h: 0.4, cornerRadius: 0.1 });
    expect(rectShape.toPath(rounded).length).toBeGreaterThan(5);
    expect(rectShape.area(rounded)).toBeLessThan(0.32);
    expect(rectShape.scaleParams(rounded, 2)).toEqual({ w: 1.6, h: 0.8, cornerRadius: 0.2 });
    expect(() => rectShape.params.parse({ w: 1, h: 1, cornerRadius: -0.1 })).toThrow();
  });
});
