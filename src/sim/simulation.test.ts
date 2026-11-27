import { describe, expect, it } from 'vitest';
import { createEntityId, InvalidParameterError } from '@core/index';
import { CorpseComponent } from '@life/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { FruitComponent } from '@plants/index';
import { BERRY_BUSH_BLUEPRINT } from '@species/index';
import { TransformComponent } from '@world/index';
import { createDefaultMeadowScenario, createEmptySandboxScenario } from './scenario';
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

  it('supports spawn-species, clear-world, heatmap snapshots, inspection, and scenario export/replay', () => {
    const scenario = createEmptySandboxScenario(33);
    const sim = new Simulation(
      { world: scenario.world, scenario, statsIntervalTicks: 2 },
      createMockPhysicsAdapter(),
    );

    sim.enqueueCommand({
      type: 'spawn-species',
      speciesId: 'rabbit',
      position: { x: 10, y: 10 },
      angle: 0.25,
    });
    sim.enqueueCommand({
      type: 'spawn-species',
      speciesId: 'grass',
      position: { x: 14, y: 14 },
      plantStage: 'mature',
    });
    sim.stepFixed();
    sim.stepFixed();

    const stats = sim.getStats();
    expect(stats.animalCount).toBe(1);
    expect(stats.plantCount).toBe(1);
    expect(sim.getStatsHistory().length).toBeGreaterThanOrEqual(2);
    expect(sim.getGenomeSummary()).toHaveLength(1);

    const picked = sim.pickEntity({ x: 10, y: 10 });
    expect(picked).not.toBeNull();
    if (picked !== null) {
      expect(sim.inspectEntity(picked)?.speciesId).toBe('rabbit');
    }

    const heat = sim.getFieldHeatmap('soil.nutrients');
    expect(heat.cols).toBe(40);
    expect(heat.maxValue).toBeGreaterThan(0);

    const exported = sim.exportScenario();
    expect(exported.commands).toHaveLength(2);

    // Replay exported scenario and confirm bit-exact hash at tick 2
    const replay = new Simulation(
      { world: exported.world, scenario: exported, statsIntervalTicks: 2 },
      createMockPhysicsAdapter(),
    );
    replay.stepFixed();
    replay.stepFixed();
    expect(replay.computeStateHash()).toBe(sim.computeStateHash());

    // Cover fruit & corpse hashing paths too
    const fruitId = sim.world.spawnSimpleBody({ position: { x: 4, y: 4 }, radius: 0.2 });
    sim.world.ecs.addComponent(fruitId, FruitComponent, {
      speciesId: 'berry-bush',
      spec: BERRY_BUSH_BLUEPRINT.plantSpec,
      ageSeconds: 1,
      maxAgeSeconds: 20,
      seedEnergy: 3,
      scentRatePerSecond: 1,
      germinationProbability: 0.5,
      dispersalDelaySeconds: 4,
      eatenBy: null,
    });
    const corpseId = sim.world.spawnSimpleBody({ position: { x: 5, y: 5 }, radius: 0.3 });
    sim.world.ecs.addComponent(corpseId, CorpseComponent, {
      energy: 12,
      initialEnergy: 20,
      decayRatePerSecond: 1,
      scentRatePerSecond: 1,
      radius: 0.3,
    });
    expect(sim.computeStateHash()).toBeGreaterThanOrEqual(0);

    sim.enqueueCommand({ type: 'clear-world' });
    sim.stepFixed();
    expect(sim.getStats().totalEntities).toBe(0);

    sim.free();
    replay.free();
  });

  it('produces identical state hashes across two runs with the same seed and commands', () => {
    const run = () => {
      const sim = new Simulation(
        { world: baseWorld, scenario: createDefaultMeadowScenario(15) },
        createMockPhysicsAdapter(),
      );
      for (let i = 0; i < 6; i += 1) {
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
    expect(
      () => new Simulation({ world: baseWorld, statsIntervalTicks: 0 }, createMockPhysicsAdapter()),
    ).toThrow(InvalidParameterError);

    const sim = new Simulation(
      { world: baseWorld, enableReproduction: false },
      createMockPhysicsAdapter(),
    );
    sim.enqueueCommand({ type: 'spawn-species', speciesId: 'rabbit', position: { x: 5, y: 5 } });
    sim.enqueueCommand({ type: 'spawn-species', speciesId: 'grass', position: { x: 8, y: 8 } });
    sim.stepFixed();
    expect(sim.getStats().animalCount).toBe(1);
    expect(() => sim.advance(-0.1)).toThrow(InvalidParameterError);
    expect(sim.exportScenario().name).toBe('custom-session');
    sim.free();
  });
});
