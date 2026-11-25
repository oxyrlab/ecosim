import { describe, expect, it } from 'vitest';
import { maxConvexVerticesRule } from './max-convex-vertices';

describe('maxConvexVerticesRule', () => {
  it('flags physical convex colliders exceeding max vertices', () => {
    const params = maxConvexVerticesRule.params.parse({ max: 8 });
    const okHex = {
      body: {
        parts: [
          { id: 'torso', shape: { type: 'polygon', sides: 6, r: 0.2 } },
          {
            id: 'aura',
            parent: 'torso',
            joint: 'visual' as const,
            shape: { type: 'polygon', sides: 24, r: 0.3 },
          },
        ],
      },
    };
    expect(maxConvexVerticesRule.check(okHex, params, {})).toEqual([]);

    const hiResPoly = {
      body: {
        parts: [{ id: 'torso', shape: { type: 'polygon', sides: 20, r: 0.2 } }],
      },
    };
    const violations = maxConvexVerticesRule.check(hiResPoly, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.actual).toBe(20);
  });
});
