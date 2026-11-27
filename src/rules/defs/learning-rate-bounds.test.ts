import { describe, expect, it } from 'vitest';
import { learningRateBoundsRule } from './learning-rate-bounds';

describe('learning-rate-bounds rule', () => {
  it('accepts rates in [min, max] and rejects out-of-bounds rates', () => {
    expect(
      learningRateBoundsRule.check(
        {
          body: { parts: [] },
          brain: { modules: [{ instanceId: 'm', params: { learningRate: 0.2 } }] },
        },
        { min: 0.001, max: 0.5 },
        {},
      ),
    ).toEqual([]);
    expect(
      learningRateBoundsRule.check(
        {
          body: { parts: [] },
          brain: { modules: [{ instanceId: 'm', params: { learningRate: 0.9 } }] },
        },
        { min: 0.001, max: 0.5 },
        {},
      ),
    ).toHaveLength(1);
    expect(
      learningRateBoundsRule.check(
        {
          body: { parts: [] },
          brain: { modules: [{ instanceId: 'm', params: { learningRate: 0.0001 } }] },
        },
        { min: 0.001, max: 0.5 },
        {},
      ),
    ).toHaveLength(1);
  });
});
