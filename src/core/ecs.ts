import { InvariantViolationError } from './errors';
import { assertKebabCaseId, createEntityIdGenerator, type EntityId } from './ids';

/**
 * Typed token identifying a component store inside an {@link EcsWorld}.
 *
 * @typeParam T - Data type stored per entity for this component.
 */
export interface ComponentType<T> {
  /** Unique `kebab-case` identifier for this component type. */
  readonly id: string;
  /** Human-readable component name for diagnostics. */
  readonly name: string;
  /** Phantom type carrier (never populated at runtime). */
  readonly __phantom?: T;
}

/**
 * Defines a typed {@link ComponentType} token used with {@link EcsWorld}.
 *
 * @typeParam T - Data shape attached to entities for this component.
 * @param id - Unique `kebab-case` identifier (e.g. `transform`, `energy-store`).
 * @param name - Optional display name (defaults to `id`).
 * @returns Frozen {@link ComponentType} token.
 * @throws InvalidParameterError if `id` is not valid `kebab-case`.
 *
 * @example
 * const Transform = defineComponent<{ x: number; y: number }>('transform');
 */
export function defineComponent<T>(id: string, name?: string): ComponentType<T> {
  assertKebabCaseId(id, 'component id');
  return Object.freeze({ id, name: name ?? id });
}

/**
 * Lightweight, deterministic Entity-Component-System container.
 * Entities are positive integer ids; components live in typed maps keyed by {@link EntityId}.
 */
export interface EcsWorld {
  /** Current number of living entities. */
  readonly entityCount: number;

  /**
   * Allocates a new live entity with the next sequential {@link EntityId}.
   */
  createEntity(): EntityId;

  /**
   * Destroys an entity and removes all components attached to it.
   * Destroying an already-dead entity is a no-op.
   *
   * @param entity - Entity to remove.
   */
  destroyEntity(entity: EntityId): void;

  /**
   * Returns `true` if `entity` is currently alive in this world.
   *
   * @param entity - Entity identifier to check.
   */
  isAlive(entity: EntityId): boolean;

  /**
   * Returns all living entity ids in deterministic ascending creation order.
   */
  entities(): readonly EntityId[];

  /**
   * Attaches a component to a live entity, throwing if the component is already present.
   *
   * @param entity - Target live entity.
   * @param type - Component token.
   * @param data - Component value.
   * @throws InvariantViolationError if `entity` is not alive or already has `type`.
   */
  addComponent<T>(entity: EntityId, type: ComponentType<T>, data: T): void;

  /**
   * Attaches or replaces a component on a live entity.
   *
   * @param entity - Target live entity.
   * @param type - Component token.
   * @param data - Component value.
   * @throws InvariantViolationError if `entity` is not alive.
   */
  setComponent<T>(entity: EntityId, type: ComponentType<T>, data: T): void;

  /**
   * Reads a component from an entity, or `undefined` if absent (or if the entity is dead).
   *
   * @param entity - Entity to inspect.
   * @param type - Component token.
   */
  getComponent<T>(entity: EntityId, type: ComponentType<T>): T | undefined;

  /**
   * Reads a component from an entity, throwing if the entity is dead or lacks the component.
   *
   * @param entity - Target live entity.
   * @param type - Component token.
   * @throws InvariantViolationError if `entity` is not alive or lacks `type`.
   */
  requireComponent<T>(entity: EntityId, type: ComponentType<T>): T;

  /**
   * Returns `true` if `entity` is alive and has component `type`.
   *
   * @param entity - Entity to inspect.
   * @param type - Component token.
   */
  hasComponent<T>(entity: EntityId, type: ComponentType<T>): boolean;

  /**
   * Removes component `type` from `entity`.
   *
   * @param entity - Entity to modify.
   * @param type - Component token.
   * @returns `true` if the component existed and was removed.
   */
  removeComponent<T>(entity: EntityId, type: ComponentType<T>): boolean;

  /**
   * Returns all living entities that possess every component listed in `types`, in deterministic
   * ascending {@link EntityId} order. Calling `query()` with zero types returns all live entities.
   *
   * @param types - Component tokens to intersect.
   */
  query(...types: readonly ComponentType<unknown>[]): EntityId[];

  /**
   * Removes all entities and components and resets the internal id generator.
   */
  clear(): void;
}

/**
 * Creates a new empty {@link EcsWorld}.
 *
 * @returns Fresh {@link EcsWorld} instance.
 */
export function createEcsWorld(): EcsWorld {
  let idGenerator = createEntityIdGenerator(1);
  const alive = new Set<EntityId>();
  const stores = new Map<string, Map<EntityId, unknown>>();

  const getOrCreateStore = (id: string): Map<EntityId, unknown> => {
    let store = stores.get(id);
    if (store === undefined) {
      store = new Map<EntityId, unknown>();
      stores.set(id, store);
    }
    return store;
  };

  const assertAlive = (entity: EntityId, operation: string): void => {
    if (!alive.has(entity)) {
      throw new InvariantViolationError(
        `Cannot ${operation} on entity ${entity}: entity is not alive.`,
      );
    }
  };

  return {
    get entityCount(): number {
      return alive.size;
    },

    createEntity(): EntityId {
      const entity = idGenerator.next();
      alive.add(entity);
      return entity;
    },

    destroyEntity(entity: EntityId): void {
      if (!alive.delete(entity)) return;
      for (const store of stores.values()) {
        store.delete(entity);
      }
    },

    isAlive(entity: EntityId): boolean {
      return alive.has(entity);
    },

    entities(): readonly EntityId[] {
      return Array.from(alive);
    },

    addComponent<T>(entity: EntityId, type: ComponentType<T>, data: T): void {
      assertAlive(entity, `add component "${type.id}"`);
      const store = getOrCreateStore(type.id);
      if (store.has(entity)) {
        throw new InvariantViolationError(
          `Entity ${entity} already has component "${type.id}". Use setComponent to replace it.`,
        );
      }
      store.set(entity, data);
    },

    setComponent<T>(entity: EntityId, type: ComponentType<T>, data: T): void {
      assertAlive(entity, `set component "${type.id}"`);
      getOrCreateStore(type.id).set(entity, data);
    },

    getComponent<T>(entity: EntityId, type: ComponentType<T>): T | undefined {
      if (!alive.has(entity)) return undefined;
      return stores.get(type.id)?.get(entity) as T | undefined;
    },

    requireComponent<T>(entity: EntityId, type: ComponentType<T>): T {
      assertAlive(entity, `require component "${type.id}"`);
      const store = stores.get(type.id);
      if (store === undefined || !store.has(entity)) {
        throw new InvariantViolationError(
          `Entity ${entity} is missing required component "${type.id}".`,
        );
      }
      return store.get(entity) as T;
    },

    hasComponent<T>(entity: EntityId, type: ComponentType<T>): boolean {
      if (!alive.has(entity)) return false;
      return stores.get(type.id)?.has(entity) ?? false;
    },

    removeComponent<T>(entity: EntityId, type: ComponentType<T>): boolean {
      if (!alive.has(entity)) return false;
      return stores.get(type.id)?.delete(entity) ?? false;
    },

    query(...types: readonly ComponentType<unknown>[]): EntityId[] {
      if (types.length === 0) {
        return Array.from(alive);
      }

      const matchedStores: Array<Map<EntityId, unknown>> = [];
      for (const type of types) {
        const store = stores.get(type.id);
        if (store === undefined || store.size === 0) {
          return [];
        }
        matchedStores.push(store);
      }

      // Iterate the smallest component store to minimize intersection checks.
      let smallestIndex = 0;
      for (let i = 1; i < matchedStores.length; i += 1) {
        const candidate = matchedStores[i];
        const currentSmallest = matchedStores[smallestIndex];
        if (
          candidate !== undefined &&
          currentSmallest !== undefined &&
          candidate.size < currentSmallest.size
        ) {
          smallestIndex = i;
        }
      }

      const primary = matchedStores[smallestIndex];
      if (primary === undefined) return [];

      const result: EntityId[] = [];
      for (const entity of primary.keys()) {
        let matchesAll = true;
        for (let i = 0; i < matchedStores.length; i += 1) {
          if (i === smallestIndex) continue;
          const other = matchedStores[i];
          if (other === undefined || !other.has(entity)) {
            matchesAll = false;
            break;
          }
        }
        if (matchesAll) {
          result.push(entity);
        }
      }

      // Guarantee deterministic ascending EntityId order regardless of component attachment order.
      result.sort((a, b) => a - b);
      return result;
    },

    clear(): void {
      alive.clear();
      stores.clear();
      idGenerator = createEntityIdGenerator(1);
    },
  };
}
