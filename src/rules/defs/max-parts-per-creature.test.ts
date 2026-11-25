import { describe, expect, it } from 'vitest';
import { maxPartsPerCreatureRule } from './max-parts-per-creature';

describe('maxPartsPerCreatureRule', () => {
  it('passes within limit and warns when expanded parts exceed max', () => {
    const params = maxPartsPerCreatureRule.params.parse({ max: 3 });
    const ok = {
      body: {
        parts: [
          { id: 'torso', shape: { type: 'circle', r: 0.2 } },
          { id: 'ear', parent: 'torso', mirror: true, shape: { type: 'circle', r: 0.05 } },
        ],
      },
    };
    expect(maxPartsPerCreatureRule.check(ok, params, {})).toEqual([]);

    const tooMany = {
      body: {
        parts: [
          ...ok.body.parts,
          { id: 'tail', parent: 'torso', shape: { type: 'circle', r: 0.05 } },
        ],
      },
    };
    const violations = maxPartsPerCreatureRule.check(tooMany, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.actual).toBe(4);
    expect(violations[0]?.limit).toBe(3);
  });
});
