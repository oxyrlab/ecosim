import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { getHormoneSpec, HORMONE_SPECS } from './hormones';

describe('hormones', () => {
  it('exposes standard broadcast hormone channels and rejects unknown ids', () => {
    expect(Object.keys(HORMONE_SPECS)).toContain('hormone.adrenaline');
    expect(Object.keys(HORMONE_SPECS)).toContain('hormone.aversive');
    expect(getHormoneSpec('hormone.reward').merge).toBe('max');
    expect(() => getHormoneSpec('hormone.unknown')).toThrow(InvalidParameterError);
  });
});
