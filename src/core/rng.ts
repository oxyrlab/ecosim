import { InvalidParameterError } from './errors';
import type { EntityId } from './ids';

/**
 * Minimal randomness interface injected into simulation components and compatible with
 * `@oxyrlab/neuro-learn`. Simulation code must never call `Math.random()`.
 */
export interface Rng {
  /** Returns a uniformly distributed float in the half-open interval `[0, 1)`. */
  next(): number;
}

/**
 * Deterministic pseudo-random number generator with convenience distribution helpers.
 */
export interface SeededRng extends Rng {
  /**
   * Returns a uniformly distributed float in `[min, max)`.
   *
   * @param min - Inclusive lower bound (finite).
   * @param max - Exclusive upper bound (finite, strictly greater than `min`).
   */
  nextRange(min: number, max: number): number;

  /**
   * Returns a uniformly distributed integer in `[minInclusive, maxExclusive)`.
   *
   * @param minInclusive - Inclusive integer lower bound.
   * @param maxExclusive - Exclusive integer upper bound (strictly greater than `minInclusive`).
   */
  nextInt(minInclusive: number, maxExclusive: number): number;

  /**
   * Returns `true` with the given probability in `[0, 1]` (default `0.5`).
   *
   * @param probability - Probability of returning `true` (`0 <= probability <= 1`).
   */
  nextBool(probability?: number): boolean;

  /**
   * Returns a normally distributed float using the Box-Muller transform.
   *
   * @param mean - Distribution mean (default `0`).
   * @param stdDev - Non-negative standard deviation (default `1`).
   */
  nextGaussian(mean?: number, stdDev?: number): number;

  /**
   * Derives a new independent {@link SeededRng} from this generator and an integer salt.
   *
   * @param salt - Integer salt distinguishing the derived stream.
   */
  fork(salt: number): SeededRng;
}

/**
 * Mixes two 32-bit integers into a well-distributed unsigned 32-bit integer seed.
 */
function mix32(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ ((b + 0x85ebca6b) >>> 0), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Derives a deterministic 32-bit integer seed for an entity from the world seed and entity id.
 *
 * @param worldSeed - Integer seed of the world.
 * @param entityId - Positive integer entity identifier.
 * @returns Unsigned 32-bit integer seed suitable for {@link createSeededRng}.
 * @throws InvalidParameterError if `worldSeed` is not an integer or `entityId` is not a positive integer.
 *
 * @example
 * const seed = deriveEntitySeed(12345, createEntityId(7));
 * const rng = createSeededRng(seed);
 */
export function deriveEntitySeed(worldSeed: number, entityId: EntityId): number {
  if (!Number.isInteger(worldSeed)) {
    throw new InvalidParameterError('worldSeed', worldSeed, 'an integer', 'deriveEntitySeed');
  }
  if (!Number.isSafeInteger(entityId) || entityId < 1) {
    throw new InvalidParameterError(
      'entityId',
      entityId,
      'a positive safe integer (>= 1)',
      'deriveEntitySeed',
    );
  }
  return mix32(worldSeed >>> 0, entityId >>> 0);
}

/**
 * Creates a fast, deterministic seeded PRNG (mulberry32).
 * The same seed always produces the exact same sequence across platforms.
 *
 * @param seed - Any integer seed (low 32 bits are used).
 * @returns A {@link SeededRng} instance.
 * @throws InvalidParameterError if `seed` is not an integer.
 *
 * @example
 * const rng = createSeededRng(42);
 * const value = rng.next();
 */
export function createSeededRng(seed: number): SeededRng {
  if (!Number.isInteger(seed)) {
    throw new InvalidParameterError('seed', seed, 'an integer', 'createSeededRng');
  }

  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,

    nextRange(min: number, max: number): number {
      if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
        throw new InvalidParameterError(
          'range',
          [min, max],
          'finite numbers with min < max',
          'SeededRng.nextRange',
        );
      }
      return min + next() * (max - min);
    },

    nextInt(minInclusive: number, maxExclusive: number): number {
      if (
        !Number.isInteger(minInclusive) ||
        !Number.isInteger(maxExclusive) ||
        minInclusive >= maxExclusive
      ) {
        throw new InvalidParameterError(
          'range',
          [minInclusive, maxExclusive],
          'integers with minInclusive < maxExclusive',
          'SeededRng.nextInt',
        );
      }
      return minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
    },

    nextBool(probability = 0.5): boolean {
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new InvalidParameterError(
          'probability',
          probability,
          'a finite number in [0, 1]',
          'SeededRng.nextBool',
        );
      }
      if (probability === 0) return false;
      if (probability === 1) return true;
      return next() < probability;
    },

    nextGaussian(mean = 0, stdDev = 1): number {
      if (!Number.isFinite(mean)) {
        throw new InvalidParameterError('mean', mean, 'a finite number', 'SeededRng.nextGaussian');
      }
      if (!Number.isFinite(stdDev) || stdDev < 0) {
        throw new InvalidParameterError(
          'stdDev',
          stdDev,
          'a finite number >= 0',
          'SeededRng.nextGaussian',
        );
      }
      if (stdDev === 0) return mean;
      let u1 = next();
      while (u1 === 0) {
        u1 = next();
      }
      const u2 = next();
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z0 * stdDev;
    },

    fork(salt: number): SeededRng {
      if (!Number.isInteger(salt)) {
        throw new InvalidParameterError('salt', salt, 'an integer', 'SeededRng.fork');
      }
      const current = next();
      const derived = mix32((current * 4294967296) >>> 0, salt >>> 0);
      return createSeededRng(derived);
    },
  };
}
