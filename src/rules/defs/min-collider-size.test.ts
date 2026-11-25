import { describe, expect, it } from 'vitest';
import { minColliderSizeRule } from './min-collider-size';

describe('minColliderSizeRule', () => {
  it('enforces minimum physical collider dimension while ignoring visual parts', () => {
    const params = minColliderSizeRule.params.parse({ minMeters: 0.02 });
    const validWithTinyVisual = {
      body: {
        parts: [
          { id: 'torso', shape: { type: 'rect', w: 0.2, h: 0.1 } },
          { id: 'tail', parent: 'torso', shape: { type: 'capsule', length: 0.1, radius: 0.02 } },
          { id: 'nose', parent: 'torso', shape: { type: 'triangle', w: 0.05, h: 0.05 } },
          {
            id: 'speck',
            parent: 'torso',
            joint: 'visual' as const,
            shape: { type: 'circle', r: 0.001 },
          },
        ],
      },
    };
    expect(minColliderSizeRule.check(validWithTinyVisual, params, {})).toEqual([]);

    const tinyPhysical = {
      body: {
        parts: [{ id: 'micro', shape: { type: 'circle', r: 0.005 } }],
      },
    };
    const violations = minColliderSizeRule.check(tinyPhysical, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.actual).toBeCloseTo(0.01);
    expect(violations[0]?.limit).toBe(0.02);
  });
});
