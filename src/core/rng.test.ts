import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from './errors';
import { createEntityId } from './ids';
import { createSeededRng, deriveEntitySeed } from './rng';

describe('rng', () => {
  it('produces identical sequences for the same seed', () => {
    const a = createSeededRng(12345);
    const b = createSeededRng(12345);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
    for (const value of seqA) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('rejects non-integer seeds', () => {
    expect(() => createSeededRng(1.5)).toThrow(InvalidParameterError);
    expect(() => createSeededRng(Number.NaN)).toThrow(InvalidParameterError);
    expect(() => createSeededRng(Number.POSITIVE_INFINITY)).toThrow(InvalidParameterError);
  });

  it('derives deterministic distinct entity seeds from worldSeed + entityId', () => {
    const id1 = createEntityId(1);
    const id2 = createEntityId(2);
    expect(deriveEntitySeed(99, id1)).toBe(deriveEntitySeed(99, id1));
    expect(deriveEntitySeed(99, id1)).not.toBe(deriveEntitySeed(99, id2));
    expect(deriveEntitySeed(99, id1)).not.toBe(deriveEntitySeed(100, id1));

    expect(() => deriveEntitySeed(1.2, id1)).toThrow(InvalidParameterError);
    expect(() => deriveEntitySeed(1, 0 as ReturnType<typeof createEntityId>)).toThrow(
      InvalidParameterError,
    );
  });

  it('supports nextRange, nextInt, nextBool, nextGaussian, and fork', () => {
    const rng = createSeededRng(42);

    for (let i = 0; i < 100; i += 1) {
      const r = rng.nextRange(-2.5, 3.5);
      expect(r).toBeGreaterThanOrEqual(-2.5);
      expect(r).toBeLessThan(3.5);

      const n = rng.nextInt(1, 6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThan(6);
    }

    expect(rng.nextBool(0)).toBe(false);
    expect(rng.nextBool(1)).toBe(true);
    expect(typeof rng.nextBool()).toBe('boolean');

    expect(rng.nextGaussian(5, 0)).toBe(5);
    const sample = rng.nextGaussian(0, 1);
    expect(Number.isFinite(sample)).toBe(true);

    const f1 = createSeededRng(7).fork(10);
    const f2 = createSeededRng(7).fork(10);
    const f3 = createSeededRng(7).fork(11);
    expect(f1.next()).toBe(f2.next());
    expect(f1.next()).not.toBe(f3.next());
  });

  it('rejects invalid distribution arguments', () => {
    const rng = createSeededRng(7);
    expect(() => rng.nextRange(5, 5)).toThrow(InvalidParameterError);
    expect(() => rng.nextRange(5, 1)).toThrow(InvalidParameterError);
    expect(() => rng.nextRange(Number.NaN, 1)).toThrow(InvalidParameterError);

    expect(() => rng.nextInt(3, 3)).toThrow(InvalidParameterError);
    expect(() => rng.nextInt(1.5, 4)).toThrow(InvalidParameterError);

    expect(() => rng.nextBool(-0.1)).toThrow(InvalidParameterError);
    expect(() => rng.nextBool(1.1)).toThrow(InvalidParameterError);

    expect(() => rng.nextGaussian(Number.NaN, 1)).toThrow(InvalidParameterError);
    expect(() => rng.nextGaussian(0, -1)).toThrow(InvalidParameterError);

    expect(() => rng.fork(1.5)).toThrow(InvalidParameterError);
  });
});
