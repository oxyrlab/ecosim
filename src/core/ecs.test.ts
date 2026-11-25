import { describe, expect, it } from 'vitest';
import { createEcsWorld, defineComponent } from './ecs';
import { InvalidParameterError, InvariantViolationError } from './errors';
import { createEntityId } from './ids';

const Position = defineComponent<{ x: number; y: number }>('position', 'Position');
const Energy = defineComponent<{ current: number }>('energy');
const Tag = defineComponent<{ labels: string[] }>('tag');

describe('ecs', () => {
  it('validates component ids on defineComponent', () => {
    expect(Position.id).toBe('position');
    expect(Position.name).toBe('Position');
    expect(Energy.name).toBe('energy');
    expect(() => defineComponent('BadName')).toThrow(InvalidParameterError);
  });

  it('creates, queries, updates, and destroys entities deterministically', () => {
    const world = createEcsWorld();
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    const e3 = world.createEntity();

    expect(world.entityCount).toBe(3);
    expect(world.isAlive(e1)).toBe(true);
    expect(world.entities()).toEqual([e1, e2, e3]);

    // Attach out of order to verify query returns deterministic ascending EntityId order.
    world.addComponent(e3, Position, { x: 3, y: 0 });
    world.addComponent(e1, Position, { x: 1, y: 0 });
    world.addComponent(e2, Position, { x: 2, y: 0 });

    world.addComponent(e3, Energy, { current: 30 });
    world.addComponent(e1, Energy, { current: 10 });

    expect(world.query(Position, Energy)).toEqual([e1, e3]);
    expect(world.query(Energy, Position)).toEqual([e1, e3]);
    expect(world.query()).toEqual([e1, e2, e3]);
    expect(world.query(Tag)).toEqual([]);

    expect(world.getComponent(e1, Energy)).toEqual({ current: 10 });
    expect(world.requireComponent(e1, Energy)).toEqual({ current: 10 });
    expect(world.hasComponent(e2, Energy)).toBe(false);

    world.setComponent(e1, Energy, { current: 25 });
    expect(world.getComponent(e1, Energy)).toEqual({ current: 25 });

    expect(world.removeComponent(e1, Energy)).toBe(true);
    expect(world.removeComponent(e1, Energy)).toBe(false);
    expect(world.query(Position, Energy)).toEqual([e3]);

    world.destroyEntity(e3);
    world.destroyEntity(e3); // idempotent
    expect(world.isAlive(e3)).toBe(false);
    expect(world.entityCount).toBe(2);
    expect(world.getComponent(e3, Position)).toBeUndefined();
    expect(world.hasComponent(e3, Position)).toBe(false);
    expect(world.removeComponent(e3, Position)).toBe(false);
    expect(world.query(Position)).toEqual([e1, e2]);
  });

  it('throws InvariantViolationError on invalid entity/component operations', () => {
    const world = createEcsWorld();
    const e1 = world.createEntity();
    world.addComponent(e1, Energy, { current: 5 });

    expect(() => world.addComponent(e1, Energy, { current: 6 })).toThrow(InvariantViolationError);
    expect(() => world.requireComponent(e1, Position)).toThrow(InvariantViolationError);

    world.destroyEntity(e1);
    expect(() => world.addComponent(e1, Position, { x: 0, y: 0 })).toThrow(InvariantViolationError);
    expect(() => world.setComponent(e1, Position, { x: 0, y: 0 })).toThrow(InvariantViolationError);
    expect(() => world.requireComponent(e1, Energy)).toThrow(InvariantViolationError);

    const ghost = createEntityId(999);
    expect(world.isAlive(ghost)).toBe(false);
    expect(world.getComponent(ghost, Energy)).toBeUndefined();
  });

  it('clears all entities and resets id sequence', () => {
    const world = createEcsWorld();
    world.createEntity();
    world.createEntity();
    world.clear();

    expect(world.entityCount).toBe(0);
    expect(world.createEntity()).toBe(1);
  });
});
