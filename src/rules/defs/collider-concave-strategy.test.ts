import { describe, expect, it } from 'vitest';
import { colliderConcaveStrategyRule } from './collider-concave-strategy';

describe('colliderConcaveStrategyRule', () => {
  const concaveBody = {
    body: {
      parts: [
        {
          id: 'crescent',
          shape: {
            type: 'convex',
            points: [
              { x: -0.5, y: -0.5 },
              { x: 0.5, y: -0.5 },
              { x: 0, y: -0.1 },
              { x: 0.5, y: 0.5 },
              { x: -0.5, y: 0.5 },
            ],
          },
        },
        {
          id: 'visual-arrow',
          parent: 'crescent',
          joint: 'visual' as const,
          shape: {
            type: 'convex',
            points: [
              { x: -0.2, y: -0.2 },
              { x: 0.2, y: -0.2 },
              { x: 0, y: -0.05 },
              { x: 0.2, y: 0.2 },
              { x: -0.2, y: 0.2 },
            ],
          },
        },
      ],
    },
  };

  it('allows concave shapes under hull/decompose and rejects physical concave parts under reject', () => {
    expect(
      colliderConcaveStrategyRule.check(
        concaveBody,
        colliderConcaveStrategyRule.params.parse({ strategy: 'hull' }),
        {},
      ),
    ).toEqual([]);
    expect(
      colliderConcaveStrategyRule.check(
        concaveBody,
        colliderConcaveStrategyRule.params.parse({ strategy: 'decompose' }),
        {},
      ),
    ).toEqual([]);

    const violations = colliderConcaveStrategyRule.check(
      concaveBody,
      colliderConcaveStrategyRule.params.parse({ strategy: 'reject' }),
      {},
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.path).toBe('body.parts.crescent.shape');
  });
});
