import { describe, expect, it } from 'vitest';
import { chain } from '@appearance/index';
import { maxJointChainLengthRule } from './max-joint-chain-length';

describe('maxJointChainLengthRule', () => {
  it('flags jointed chains longer than max', () => {
    const params = maxJointChainLengthRule.params.parse({ max: 4 });
    const okWorm = { body: { parts: chain({ count: 4, shape: { type: 'circle', r: 0.1 } }) } };
    expect(maxJointChainLengthRule.check(okWorm, params, {})).toEqual([]);

    const longWorm = { body: { parts: chain({ count: 6, shape: { type: 'circle', r: 0.1 } }) } };
    const violations = maxJointChainLengthRule.check(longWorm, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.actual).toBe(6);
  });
});
