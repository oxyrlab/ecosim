import { describe, expect, it } from 'vitest';
import { resolveLayout } from '@appearance/layout';
import { SignalBus } from '@bus/signal-bus';
import { createSeededRng, InvalidParameterError } from '@core/index';
import { EnergyComponent, HealthComponent } from '@life/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { PhysicsBodyComponent, World } from '@world/index';
import { CreatureBrainComponent, stepNervousSystem } from './creature-runtime';
import { spawnSpeciesEntity } from './entity-factory';
import { FOX_BLUEPRINT } from './fox/blueprint';

describe('creature nervous runtime', () => {
  it('validates dt, skips dead creatures, and exercises sensor/actuator callbacks (raycast, field, impulse, emitField)', () => {
    const world = new World(
      { seed: 1, widthMeters: 20, heightMeters: 20, gridCols: 10, gridRows: 10 },
      createMockPhysicsAdapter(),
    );
    expect(CreatureBrainComponent.id).toBe('creature-brain');
    expect(stepNervousSystem(world, 0)).toEqual([]);
    expect(stepNervousSystem(world, 1 / 30)).toEqual([]);
    expect(() => stepNervousSystem(world, -0.1)).toThrow(InvalidParameterError);

    // Spawn a target in front of a custom test creature
    const target = world.spawnSimpleBody({
      position: { x: 8, y: 5 },
      radius: 0.4,
      tags: ['target'],
    });
    const actor = world.spawnSimpleBody({
      position: { x: 5, y: 5 },
      radius: 0.3,
      tags: ['tester'],
    });
    const body = world.ecs.requireComponent(actor, PhysicsBodyComponent);

    let rayHitTarget = false;
    let unknownFieldVal = -1;
    let sawNeighbor = false;

    const bus = new SignalBus([]);
    world.ecs.addComponent(actor, CreatureBrainComponent, {
      speciesId: 'tester',
      bus,
      layout: resolveLayout([{ id: 'torso', shape: { type: 'circle', r: 0.3 } }]),
      rng: createSeededRng(2),
      sensors: [
        {
          instanceId: 'probe',
          localPosition: { x: 0, y: 0 },
          localAngle: 0,
          instance: {
            sample(ctx) {
              const neighbors = ctx.queryNeighbors(ctx.position, 5);
              sawNeighbor = neighbors.some((n) => n.entityId === target);
              unknownFieldVal = ctx.sampleField('nonexistent.field', 5, 5);
              const hit = ctx.castRay(ctx.position, { x: 1, y: 0 }, 5);
              rayHitTarget = hit !== null && hit.entityId === target;
              // Also test a miss ray
              expect(ctx.castRay(ctx.position, { x: 0, y: 1 }, 0.5)).toBeNull();
            },
          },
        },
      ],
      brainModules: [],
      spine: { tick() {} },
      actuators: [
        {
          instanceId: 'custom',
          targetBody: body.bodyHandle,
          localPosition: { x: 0, y: 0 },
          localAngle: 0,
          instance: {
            apply(ctx) {
              ctx.applyForce({ x: 1, y: 0 });
              ctx.applyImpulse({ x: 0.5, y: 0 });
              ctx.applyTorque(0.2);
              ctx.emitField('scent.prey', 5, 5, 2);
              ctx.emitField('nonexistent.field', 5, 5, 1);
              ctx.consumeEnergy(1);
              ctx.emitAction({
                kind: 'bite',
                actorEntityId: ctx.entityId,
                origin: ctx.worldPosition,
                direction: { x: 1, y: 0 },
                rangeMeters: 0.5,
                damage: 5,
              });
            },
          },
        },
      ],
    });

    const events = stepNervousSystem(world, 0.1);
    expect(sawNeighbor).toBe(true);
    expect(unknownFieldVal).toBe(0);
    expect(rayHitTarget).toBe(true);
    expect(events).toHaveLength(1);
    expect(world.fields.get('scent.prey').totalMass()).toBeGreaterThan(0);

    // Dead fox is skipped cleanly
    const fox = spawnSpeciesEntity(world, FOX_BLUEPRINT, { x: 12, y: 12 });
    world.ecs.requireComponent(fox, HealthComponent).dead = true;
    world.ecs.requireComponent(fox, EnergyComponent).current = 10;
    const events2 = stepNervousSystem(world, 0.1);
    expect(events2).toHaveLength(1); // only the alive custom tester

    world.free();
  });
});
