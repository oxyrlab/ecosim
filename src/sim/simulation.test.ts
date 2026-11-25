import { describe, expect, it } from 'vitest';
import { createEntityId, InvalidParameterError } from '@core/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { TransformComponent } from '@world/index';
import { Simulation } from './simulation';

describe('Simulation', () => {
  const baseWorld = {
    seed: 101,
    widthMeters: 20,
    heightMeters: 20,
    gridCols: 10,
    gridRows: 10,
  };

  it('runs fixed-timestep accumulator, executes commands deterministically, and diffuses fields', () => {
    const sim = new Simulation(
      { world: baseWorld, maxSubStepsPerAdvance: 4 },
      createMockPhysicsAdapter(),
    );
    sim.enqueueCommand({
      type: 'spawn-body',
      position: { x: 5, y: 5 },
      radius: 0.5,
      linearVelocity: { x: 3, y: 0 },
      color: 0x38bdf8,
      kind: 1,
      tags: ['demo'],
    });
    sim.enqueueCommand({
      type: 'paint-field',
      fieldName: 'scent.plant',
      x: 10,
      y: 10,
      radiusMeters: 2,
      value: 5,
      mode: 'set',
    });

    // Advance by 0.1s at 30Hz -> 3 fixed ticks
    const executed = sim.advance(0.1);
    expect(executed).toBe(3);
    expect(sim.world.tick).toBe(3);
    expect(sim.getCommandHistory()).toHaveLength(2);
    expect(sim.getLastCollisionEvents()).toEqual([]);

    const e1 = createEntityId(1);
    sim.enqueueCommand({ type: 'apply-impulse', entityId: e1, impulse: { x: 0, y: 2 } });
    // Advance large delta -> capped at maxSubStepsPerAdvance (4)
    expect(sim.advance(1.0)).toBe(4);
    expect(sim.world.tick).toBe(7); // crossed diffusion cadence (6 ticks)
    expect(sim.world.ecs.requireComponent(e1, TransformComponent).y).toBeGreaterThan(5);

    const snap = sim.getSnapshot();
    expect(snap.entityCount).toBe(1);

    sim.enqueueCommand({ type: 'remove-entity', entityId: e1 });
    sim.enqueueCommand({
      type: 'apply-impulse',
      entityId: createEntityId(999),
      impulse: { x: 1, y: 0 },
    });
    sim.stepFixed();
    expect(sim.getSnapshot().entityCount).toBe(0);

    sim.free();
  });

  it('produces identical state hashes across two runs with the same seed and commands', () => {
    const run = () => {
      const sim = new Simulation({ world: baseWorld }, createMockPhysicsAdapter());
      sim.enqueueCommand({
        type: 'spawn-body',
        position: { x: 4, y: 6 },
        radius: 0.4,
        linearVelocity: { x: 1.5, y: -0.5 },
      });
      sim.enqueueCommand({
        type: 'paint-field',
        fieldName: 'scent.prey',
        x: 6,
        y: 6,
        radiusMeters: 1.5,
        value: 3,
      });
      for (let i = 0; i < 18; i += 1) {
        sim.stepFixed();
      }
      const hash = sim.computeStateHash();
      sim.free();
      return hash;
    };

    expect(run()).toBe(run());
  });

  it('validates configuration and advance arguments', () => {
    expect(
      () =>
        new Simulation(
          { world: baseWorld, rates: { physicsRateHz: 0 } },
          createMockPhysicsAdapter(),
        ),
    ).toThrow(InvalidParameterError);
    expect(
      () =>
        new Simulation(
          { world: baseWorld, rates: { fieldDiffusionRateHz: -1 } },
          createMockPhysicsAdapter(),
        ),
    ).toThrow(InvalidParameterError);
    expect(
      () =>
        new Simulation({ world: baseWorld, maxSubStepsPerAdvance: 0 }, createMockPhysicsAdapter()),
    ).toThrow(InvalidParameterError);

    const sim = new Simulation({ world: baseWorld }, createMockPhysicsAdapter());
    expect(() => sim.advance(-0.1)).toThrow(InvalidParameterError);
    sim.free();
  });
});
