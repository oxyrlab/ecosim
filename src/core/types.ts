import type { z } from 'zod';
import { InvalidParameterError } from './errors';

/**
 * Shared self-describing metadata implemented by every registered component definition
 * (organs, sensors, actuators, brain modules, spines, shapes, rules, and species).
 *
 * @typeParam P - Validated parameter type produced by `params`.
 */
export interface ComponentMeta<P> {
  /** Unique `kebab-case` identifier within its registry. */
  readonly id: string;
  /** Concise 1-2 sentence explanation surfaced in generated catalog docs. */
  readonly description: string;
  /** Zod schema validating component parameters and documenting defaults/ranges. */
  readonly params: z.ZodType<P>;
  /** Optional classification tags. */
  readonly tags?: readonly string[];
}

/**
 * Returns `true` when `value` is a finite number (neither `NaN`, `Infinity`, nor `-Infinity`).
 *
 * @param value - Number to inspect.
 * @returns Whether `value` is finite.
 */
export function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

/**
 * Guards simulation boundaries against `NaN` and `Infinity`.
 *
 * @param name - Parameter or field name for error reporting.
 * @param value - Numeric value to validate.
 * @param context - Optional location context.
 * @returns `value` unchanged when finite.
 * @throws InvalidParameterError if `value` is `NaN` or infinite.
 */
export function assertFiniteNumber(name: string, value: number, context?: string): number {
  if (!Number.isFinite(value)) {
    throw new InvalidParameterError(name, value, 'a finite number', context);
  }
  return value;
}

/**
 * Validates that a finite number lies within the inclusive interval `[min, max]`.
 *
 * @param name - Parameter name for error reporting.
 * @param value - Numeric value to validate.
 * @param min - Inclusive lower bound.
 * @param max - Inclusive upper bound (must be >= `min`).
 * @param context - Optional location context.
 * @returns `value` unchanged when valid.
 * @throws InvalidParameterError if bounds are invalid or `value` is outside `[min, max]`.
 */
export function assertInRange(
  name: string,
  value: number,
  min: number,
  max: number,
  context?: string,
): number {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new InvalidParameterError('range', [min, max], 'finite bounds with min <= max', context);
  }
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new InvalidParameterError(name, value, `a finite number in [${min}, ${max}]`, context);
  }
  return value;
}

/**
 * Clamps a finite number into the inclusive interval `[min, max]`.
 *
 * @param value - Input number.
 * @param min - Inclusive lower bound.
 * @param max - Inclusive upper bound (must be >= `min`).
 * @returns Clamped value in `[min, max]`.
 * @throws InvalidParameterError if any input is non-finite or `min > max`.
 */
export function clamp(value: number, min: number, max: number): number {
  assertFiniteNumber('value', value, 'clamp');
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new InvalidParameterError('range', [min, max], 'finite bounds with min <= max', 'clamp');
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
