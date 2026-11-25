import { InvalidParameterError } from './errors';

/**
 * Opaque positive integer identifying a live or previously spawned ECS entity.
 */
export type EntityId = number & { readonly __brand: 'EntityId' };

/**
 * Pattern enforced on all registry identifiers (`kebab-case`, starting with a lowercase letter).
 */
const KEBAB_CASE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Checks whether a string is a valid `kebab-case` identifier (e.g. `vision-sensor`, `body-core`).
 *
 * @param value - Candidate identifier string.
 * @returns `true` if `value` matches `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`.
 *
 * @example
 * isKebabCaseId('vision-sensor'); // true
 * isKebabCaseId('VisionSensor'); // false
 */
export function isKebabCaseId(value: string): boolean {
  return KEBAB_CASE_PATTERN.test(value);
}

/**
 * Validates that a string is a non-empty `kebab-case` identifier and returns it unchanged.
 *
 * @param value - Candidate identifier.
 * @param label - Parameter label used in error messages (e.g. `rule id`).
 * @returns The validated identifier string.
 * @throws InvalidParameterError if `value` is not valid `kebab-case`.
 */
export function assertKebabCaseId(value: string, label: string): string {
  if (!isKebabCaseId(value)) {
    throw new InvalidParameterError(
      label,
      value,
      'a kebab-case identifier (lowercase letters, digits, and single hyphens, starting with a letter)',
    );
  }
  return value;
}

/**
 * Converts a positive safe integer into a branded {@link EntityId}.
 *
 * @param raw - Positive integer (>= 1).
 * @returns Branded {@link EntityId}.
 * @throws InvalidParameterError if `raw` is not a positive safe integer.
 */
export function createEntityId(raw: number): EntityId {
  if (!Number.isSafeInteger(raw) || raw < 1) {
    throw new InvalidParameterError('entityId', raw, 'a positive safe integer (>= 1)');
  }
  return raw as EntityId;
}

/**
 * Deterministic generator of sequential {@link EntityId} values.
 */
export interface EntityIdGenerator {
  /** Allocates and returns the next {@link EntityId}. */
  next(): EntityId;
  /** Returns the next id that will be issued without advancing the generator. */
  peek(): EntityId;
}

/**
 * Creates a deterministic sequential {@link EntityIdGenerator}.
 *
 * @param start - First integer id to issue (default: `1`, must be a positive safe integer).
 * @returns An {@link EntityIdGenerator} instance.
 * @throws InvalidParameterError if `start` is not a positive safe integer.
 */
export function createEntityIdGenerator(start = 1): EntityIdGenerator {
  if (!Number.isSafeInteger(start) || start < 1) {
    throw new InvalidParameterError(
      'start',
      start,
      'a positive safe integer (>= 1)',
      'createEntityIdGenerator',
    );
  }
  let current = start;
  return {
    next(): EntityId {
      const issued = current as EntityId;
      current += 1;
      return issued;
    },
    peek(): EntityId {
      return current as EntityId;
    },
  };
}
