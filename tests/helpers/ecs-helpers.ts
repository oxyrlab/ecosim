import { createEcsWorld, type ComponentType, type EcsWorld, type EntityId } from '@core/index';

/**
 * Tuple pairing a {@link ComponentType} with its initial data for {@link spawnTestEntity}.
 */
export type ComponentEntry<T = unknown> = readonly [type: ComponentType<T>, data: T];

/**
 * Creates a fresh isolated {@link EcsWorld} for unit and integration tests.
 */
export function createTestEcsWorld(): EcsWorld {
  return createEcsWorld();
}

/**
 * Spawns an entity in `world` and attaches all supplied components.
 *
 * @param world - Target test ECS world.
 * @param components - Initial components to attach.
 * @returns The newly created {@link EntityId}.
 */
export function spawnTestEntity(
  world: EcsWorld,
  components: readonly ComponentEntry[] = [],
): EntityId {
  const entity = world.createEntity();
  for (const [type, data] of components) {
    world.addComponent(entity, type, data);
  }
  return entity;
}
