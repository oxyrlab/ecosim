import { DuplicateRegistrationError, RegistryNotFoundError } from './errors';
import { assertKebabCaseId } from './ids';

/**
 * Minimum shape required of any item stored in a {@link Registry}.
 */
export interface RegistryEntry {
  /** Unique `kebab-case` identifier for this item. */
  readonly id: string;
}

/**
 * Typed key-value registry enforcing unique `kebab-case` identifiers and deterministic
 * insertion-order iteration.
 *
 * @typeParam T - Registered definition type.
 */
export interface Registry<T extends RegistryEntry> {
  /** Human-readable name of this registry (used in error messages and docs). */
  readonly name: string;
  /** Number of registered entries. */
  readonly size: number;

  /**
   * Registers an item under its `id`.
   *
   * @param item - Definition to register.
   * @returns The registered item unchanged (useful for inline export patterns).
   * @throws InvalidParameterError if `item.id` is not valid `kebab-case`.
   * @throws DuplicateRegistrationError if `item.id` is already registered.
   */
  register(item: T): T;

  /**
   * Retrieves a registered item by `id`.
   *
   * @param id - Registered `kebab-case` identifier.
   * @returns The matching definition.
   * @throws RegistryNotFoundError if `id` is not registered.
   */
  get(id: string): T;

  /**
   * Retrieves a registered item by `id`, or `undefined` if not present.
   *
   * @param id - Identifier to look up.
   * @returns Matching item or `undefined`.
   */
  tryGet(id: string): T | undefined;

  /**
   * Checks whether `id` is currently registered.
   *
   * @param id - Identifier to check.
   * @returns `true` if registered.
   */
  has(id: string): boolean;

  /**
   * Returns all registered items in deterministic registration order.
   */
  list(): readonly T[];

  /**
   * Returns all registered ids in deterministic registration order.
   */
  ids(): readonly string[];

  /**
   * Removes all entries from the registry (primarily for isolated test cleanup).
   */
  clear(): void;
}

/**
 * Creates an empty {@link Registry} for a category of EcoSim definitions.
 *
 * @typeParam T - Registered item type containing a `kebab-case` `id`.
 * @param name - Human-readable registry name (e.g. `rule`, `shape`, `sensor`).
 * @returns A new {@link Registry} instance.
 *
 * @example
 * const shapeRegistry = createRegistry<ShapeDef<unknown>>('shape');
 */
export function createRegistry<T extends RegistryEntry>(name: string): Registry<T> {
  const entries = new Map<string, T>();

  return {
    name,

    get size(): number {
      return entries.size;
    },

    register(item: T): T {
      assertKebabCaseId(item.id, `${name} id`);
      if (entries.has(item.id)) {
        throw new DuplicateRegistrationError(name, item.id);
      }
      entries.set(item.id, item);
      return item;
    },

    get(id: string): T {
      const found = entries.get(id);
      if (found === undefined) {
        throw new RegistryNotFoundError(name, id, Array.from(entries.keys()));
      }
      return found;
    },

    tryGet(id: string): T | undefined {
      return entries.get(id);
    },

    has(id: string): boolean {
      return entries.has(id);
    },

    list(): readonly T[] {
      return Array.from(entries.values());
    },

    ids(): readonly string[] {
      return Array.from(entries.keys());
    },

    clear(): void {
      entries.clear();
    },
  };
}
