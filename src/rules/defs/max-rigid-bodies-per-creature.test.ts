import { describe, expect, it } from 'vitest';
import { chain } from '@appearance/index';
import { maxRigidBodiesPerCreatureRule } from './max-rigid-bodies-per-creature';

describe('maxRigidBodiesPerCreatureRule', () => {
  it('counts only distinct rigid bodies (not fixed/visual parts)', () => {
    const params = maxRigidBodiesPerCreatureRule.params.parse({ max: 2 });
    const compound = {
      body: {
        parts: [
          { id: 'torso', shape: { type: 'circle', r: 0.2 } },
          {
            id: 'head',
            parent: 'torso',
            joint: 'fixed' as const,
            shape: { type: 'circle', r: 0.1 },
          },
          {
            id: 'ear',
            parent: 'head',
            joint: 'visual' as const,
            mirror: true,
            shape: { type: 'circle', r: 0.05 },
          },
        ],
      },
    };
    expect(maxRigidBodiesPerCreatureRule.check(compound, params, {})).toEqual([]);

    const worm4 = { body: { parts: chain({ count: 4, shape: { type: 'circle', r: 0.1 } }) } };
    const violations = maxRigidBodiesPerCreatureRule.check(worm4, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.actual).toBe(4);
  });
});
