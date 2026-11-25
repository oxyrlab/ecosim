import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from './errors';
import { assertFiniteNumber, assertInRange, clamp, isFiniteNumber } from './types';

describe('types & numeric guards', () => {
  it('checks finite numbers', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-42.5)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber(Number.NEGATIVE_INFINITY)).toBe(false);
  });

  it('asserts finite numbers at boundaries', () => {
    expect(assertFiniteNumber('dt', 1 / 30)).toBeCloseTo(1 / 30);
    expect(() => assertFiniteNumber('dt', Number.NaN, 'step')).toThrow(InvalidParameterError);
    expect(() => assertFiniteNumber('dt', Number.POSITIVE_INFINITY)).toThrow(InvalidParameterError);
  });

  it('asserts inclusive ranges and validates bounds', () => {
    expect(assertInRange('prob', 0, 0, 1)).toBe(0);
    expect(assertInRange('prob', 1, 0, 1)).toBe(1);
    expect(assertInRange('prob', 0.5, 0, 1)).toBe(0.5);

    expect(() => assertInRange('prob', -0.01, 0, 1)).toThrow(InvalidParameterError);
    expect(() => assertInRange('prob', 1.01, 0, 1)).toThrow(InvalidParameterError);
    expect(() => assertInRange('prob', Number.NaN, 0, 1)).toThrow(InvalidParameterError);
    expect(() => assertInRange('prob', 0.5, 2, 1)).toThrow(InvalidParameterError);
  });

  it('clamps finite numbers and rejects invalid inputs', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(15, 0, 10)).toBe(10);

    expect(() => clamp(Number.NaN, 0, 1)).toThrow(InvalidParameterError);
    expect(() => clamp(0.5, 5, 1)).toThrow(InvalidParameterError);
  });
});
