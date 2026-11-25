import { describe, expect, it } from 'vitest';
import { capsuleShape } from './capsule';

describe('capsuleShape', () => {
  it('computes horizontal bounds, rotated Rapier capsule collider, and area', () => {
    const params = capsuleShape.params.parse({ length: 0.3, radius: 0.05 });
    expect(capsuleShape.bounds(params)).toEqual({ w: 0.4, h: 0.1 });
    expect(capsuleShape.toColliders(params, 'hull')).toEqual([
      { shape: { kind: 'capsule', halfHeight: 0.15, radius: 0.05 }, angle: Math.PI / 2 },
    ]);
    expect(capsuleShape.scaleParams(params, 2)).toEqual({ length: 0.6, radius: 0.1 });
    expect(capsuleShape.area(params)).toBeCloseTo(0.3 * 0.1 + Math.PI * 0.0025);
    expect(() => capsuleShape.params.parse({ length: -0.1, radius: 0.1 })).toThrow();
  });
});
