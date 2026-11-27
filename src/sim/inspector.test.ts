import { describe, expect, it } from 'vitest';
import { createEntityId } from '@core/index';
import { mutationSpecSchema, ReproductionComponent, reproductionSpecSchema } from '@genome/index';
import { CorpseComponent, LifecycleComponent } from '@life/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { FruitComponent, spawnPlant } from '@plants/index';
import {
  BERRY_BUSH_BLUEPRINT,
  RABBIT_BLUEPRINT,
  spawnSpeciesEntity,
  stepNervousSystem,
} from '@species/index';
import { TransformComponent, World } from '@world/index';
import { inspectEntity, pickEntityAtWorldPos } from './inspector';

describe('inspector', () => {
  const worldCfg = {
    seed: 12,
    widthMeters: 20,
    heightMeters: 20,
    gridCols: 20,
    gridRows: 20,
  };

  it('inspects animals, plants, fruits, corpses, generic bodies, reproduction, and rule errors', () => {
    const world = new World(worldCfg, createMockPhysicsAdapter());
    expect(inspectEntity(world, createEntityId(999))).toBeNull();

    // Entity without TransformComponent returns null
    const emptyEntity = world.ecs.createEntity();
    expect(inspectEntity(world, emptyEntity)).toBeNull();

    const rabbitId = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 6, y: 6 });
    world.ecs.addComponent(rabbitId, ReproductionComponent, {
      speciesId: 'rabbit',
      blueprint: RABBIT_BLUEPRINT,
      spec: reproductionSpecSchema.parse({}),
      mutation: mutationSpecSchema.parse({}),
      cooldownRemainingSeconds: 5,
      generation: 1,
      offspringCount: 2,
    });
    stepNervousSystem(world, 1 / 30);

    const rabbitInfo = inspectEntity(world, rabbitId);
    expect(rabbitInfo).not.toBeNull();
    expect(rabbitInfo?.kingdom).toBe('animal');
    expect(rabbitInfo?.speciesId).toBe('rabbit');
    expect(rabbitInfo?.energy?.current).toBeGreaterThan(0);
    expect(rabbitInfo?.health?.current).toBeGreaterThan(0);
    expect(rabbitInfo?.reproduction?.generation).toBe(1);
    expect(rabbitInfo?.neuromodulators).toBeDefined();
    expect(rabbitInfo?.signalBus).toBeDefined();
    expect(rabbitInfo?.brainModules?.length).toBeGreaterThan(0);
    expect(rabbitInfo?.ruleViolations).toBeDefined();

    // Blueprint that triggers validation error surfaces an error violation safely
    const brokenRabbit = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 8, y: 8 });
    world.ecs.addComponent(brokenRabbit, ReproductionComponent, {
      speciesId: 'rabbit',
      blueprint: {
        ...RABBIT_BLUEPRINT,
        body: { parts: [] },
      },
      spec: reproductionSpecSchema.parse({}),
      mutation: mutationSpecSchema.parse({}),
      cooldownRemainingSeconds: 0,
      generation: 0,
      offspringCount: 0,
    });
    const brokenInfo = inspectEntity(world, brokenRabbit);
    expect(brokenInfo?.ruleViolations?.[0]?.severity).toBe('error');

    // Warning-level rule violation + animal without ReproductionComponent/LifecycleComponent
    const warnRabbit = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 9, y: 9 });
    world.ecs.addComponent(warnRabbit, ReproductionComponent, {
      speciesId: 'rabbit',
      blueprint: {
        ...RABBIT_BLUEPRINT,
        ruleOverrides: [
          {
            ruleId: 'max-brain-modules',
            severity: 'warn',
            params: { max: 1 },
            reason: 'test warning',
          },
        ],
      },
      spec: reproductionSpecSchema.parse({}),
      mutation: mutationSpecSchema.parse({}),
      cooldownRemainingSeconds: 0,
      generation: 0,
      offspringCount: 0,
    });
    const warnInfo = inspectEntity(world, warnRabbit);
    expect(warnInfo?.ruleViolations?.some((v) => v.severity === 'warn')).toBe(true);

    const plainRabbit = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 11, y: 11 });
    world.ecs.removeComponent(plainRabbit, LifecycleComponent);
    expect(inspectEntity(world, plainRabbit)?.speciesId).toBe('rabbit');

    // Bare Transform-only entity without body/stub/tags
    const bareId = world.ecs.createEntity();
    world.ecs.addComponent(bareId, TransformComponent, { x: 15, y: 15, angle: 0 });
    world.spatialHash.insert(bareId, 15, 15, 0.25);
    expect(inspectEntity(world, bareId)?.tags).toEqual([]);
    expect(pickEntityAtWorldPos(world, { x: 15, y: 15 })).toBe(bareId);

    const plantId = spawnPlant(
      world,
      BERRY_BUSH_BLUEPRINT.plantSpec,
      { x: 12, y: 12 },
      {
        stage: 'mature',
      },
    );
    const plantInfo = inspectEntity(world, plantId);
    expect(plantInfo?.kingdom).toBe('plant');
    expect(plantInfo?.plant?.stage).toBe('mature');

    const bodyId = world.spawnSimpleBody({ position: { x: 2, y: 2 }, radius: 0.4, tags: ['rock'] });
    const bodyInfo = inspectEntity(world, bodyId);
    expect(bodyInfo?.kingdom).toBe('body');
    expect(bodyInfo?.tags).toEqual(['rock']);

    // Fruit inspection
    const fruitBody = world.spawnSimpleBody({ position: { x: 3, y: 3 }, radius: 0.2 });
    world.ecs.addComponent(fruitBody, FruitComponent, {
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
    expect(inspectEntity(world, fruitBody)?.kingdom).toBe('fruit');

    // Corpse inspection
    const corpseBody = world.spawnSimpleBody({ position: { x: 4, y: 4 }, radius: 0.3 });
    world.ecs.addComponent(corpseBody, CorpseComponent, {
      energy: 15,
      initialEnergy: 20,
      decayRatePerSecond: 1,
      scentRatePerSecond: 1,
      radius: 0.3,
    });
    expect(inspectEntity(world, corpseBody)?.kingdom).toBe('corpse');

    // Pick closest entity near rabbit
    expect(pickEntityAtWorldPos(world, { x: 6.1, y: 6.0 })).toBe(rabbitId);
    expect(pickEntityAtWorldPos(world, { x: 19, y: 19 }, 0.1)).toBeNull();

    world.free();
  });
});
