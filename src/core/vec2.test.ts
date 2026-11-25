import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from './errors';
import {
  ZERO_VEC2,
  add,
  angle,
  assertFiniteVec2,
  clampLength,
  cross,
  distance,
  distanceSq,
  dot,
  equals,
  fromAngle,
  length,
  lengthSq,
  lerp,
  negate,
  normalize,
  rotate,
  scale,
  sub,
  vec2,
} from './vec2';

const finiteCoord = fc.double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true });
const arbVec2 = fc.record({ x: finiteCoord, y: finiteCoord });

describe('vec2', () => {
  it('performs basic arithmetic and geometric operations', () => {
    const a = vec2(3, 4);
    const b = vec2(1, -2);

    expect(add(a, b)).toEqual({ x: 4, y: 2 });
    expect(sub(a, b)).toEqual({ x: 2, y: 6 });
    expect(scale(a, 2)).toEqual({ x: 6, y: 8 });
    expect(negate(a)).toEqual({ x: -3, y: -4 });
    expect(dot(a, b)).toBe(-5);
    expect(cross(a, b)).toBe(-10);
    expect(lengthSq(a)).toBe(25);
    expect(length(a)).toBe(5);
    expect(distanceSq(a, ZERO_VEC2)).toBe(25);
    expect(distance(a, ZERO_VEC2)).toBe(5);
    expect(equals(normalize(a), vec2(0.6, 0.8))).toBe(true);
    expect(normalize(ZERO_VEC2)).toBe(ZERO_VEC2);
  });

  it('handles rotation, polar conversion, lerp, and clampLength', () => {
    const unitX = vec2(1, 0);
    expect(equals(rotate(unitX, Math.PI / 2), vec2(0, 1), 1e-12)).toBe(true);
    expect(angle(vec2(0, 1))).toBeCloseTo(Math.PI / 2);
    expect(equals(fromAngle(Math.PI / 2, 2), vec2(0, 2), 1e-12)).toBe(true);

    expect(lerp(vec2(0, 0), vec2(10, 20), 0.25)).toEqual({ x: 2.5, y: 5 });

    const longVec = vec2(6, 8);
    expect(equals(clampLength(longVec, 5), vec2(3, 4))).toBe(true);
    expect(clampLength(longVec, 20)).toBe(longVec);
    expect(clampLength(ZERO_VEC2, 5)).toBe(ZERO_VEC2);
    expect(() => clampLength(longVec, -1)).toThrow(InvalidParameterError);
  });

  it('validates finite vectors at boundaries', () => {
    const v = vec2(1, 2);
    expect(assertFiniteVec2('pos', v)).toBe(v);
    expect(() => assertFiniteVec2('pos', vec2(Number.NaN, 0))).toThrow(InvalidParameterError);
    expect(() => assertFiniteVec2('pos', vec2(0, Number.POSITIVE_INFINITY))).toThrow(
      InvalidParameterError,
    );
  });

  it('satisfies vector space properties (property-based)', () => {
    fc.assert(
      fc.property(arbVec2, arbVec2, (a, b) => {
        expect(equals(add(a, b), add(b, a), 1e-9)).toBe(true);
        expect(distance(a, b)).toBeCloseTo(distance(b, a), 9);
        expect(dot(a, b)).toBeCloseTo(dot(b, a), 6);
        expect(cross(a, b)).toBeCloseTo(-cross(b, a), 6);
      }),
    );

    fc.assert(
      fc.property(arbVec2, fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }), (v, theta) => {
        const rotated = rotate(v, theta);
        expect(length(rotated)).toBeCloseTo(length(v), 6);
      }),
    );
  });
});
