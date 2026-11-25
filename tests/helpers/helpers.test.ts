import { describe, expect, it } from 'vitest';
import { defineComponent } from '@core/index';
import {
  createTestEcsWorld,
  createTestRng,
  createTestRuleContext,
  createTestRuleDef,
  spawnTestEntity,
} from './index';

describe('test helpers', () => {
  it('spawns entities with initial components via spawnTestEntity', () => {
    const Pos = defineComponent<{ x: number; y: number }>('pos');
    const world = createTestEcsWorld();
    const entity = spawnTestEntity(world, [[Pos, { x: 2, y: 3 }]]);

    expect(world.isAlive(entity)).toBe(true);
    expect(world.getComponent(entity, Pos)).toEqual({ x: 2, y: 3 });

    const bare = spawnTestEntity(world);
    expect(world.isAlive(bare)).toBe(true);
  });

  it('creates deterministic test RNG, rule defs, and rule contexts', () => {
    expect(createTestRng().next()).toBe(createTestRng().next());
    const rule = createTestRuleDef();
    expect(rule.id).toBe('test-max-value');
    expect(createTestRuleContext({ speciesId: 'rabbit' })).toEqual({
      worldTick: 0,
      speciesId: 'rabbit',
    });
  });
});
