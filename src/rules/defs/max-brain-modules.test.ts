import { describe, expect, it } from 'vitest';
import { maxBrainModulesRule } from './max-brain-modules';

describe('maxBrainModulesRule', () => {
  it('checks brain module count against max', () => {
    const params = maxBrainModulesRule.params.parse({ max: 2 });
    const plant = { body: { parts: [{ id: 'stem', shape: { type: 'circle', r: 0.1 } }] } };
    expect(maxBrainModulesRule.check(plant, params, {})).toEqual([]);

    const complex = {
      ...plant,
      brain: { modules: [{ instanceId: 'a' }, { instanceId: 'b' }, { instanceId: 'c' }] },
    };
    const violations = maxBrainModulesRule.check(complex, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.actual).toBe(3);
  });
});
