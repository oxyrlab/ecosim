import { describe, expect, it } from 'vitest';
import { BlueprintValidationError } from '@core/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import type { AnimalSpeciesBlueprint } from './blueprint';
import { spawnSpeciesEntity, validateAnimalBlueprint } from './entity-factory';
import { GRASS_BLUEPRINT } from './grass';
import { RABBIT_BLUEPRINT } from './rabbit/blueprint';

describe('EntityFactory and Blueprint validation', () => {
  it('validates and spawns animal and plant blueprints and rejects unknown components or error-level rule violations', () => {
    const world = new World(
      { seed: 5, widthMeters: 30, heightMeters: 30, gridCols: 15, gridRows: 15 },
      createMockPhysicsAdapter(),
    );

    const plantId = spawnSpeciesEntity(world, GRASS_BLUEPRINT, { x: 4, y: 4 });
    expect(world.ecs.isAlive(plantId)).toBe(true);

    const rabbitId = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 10, y: 10 });
    expect(world.ecs.isAlive(rabbitId)).toBe(true);

    // Supports explicit ruleOverrides with documented reason and spawning without optional scentEmission / spine.params
    const scentless: AnimalSpeciesBlueprint = {
      id: RABBIT_BLUEPRINT.id,
      name: RABBIT_BLUEPRINT.name,
      description: RABBIT_BLUEPRINT.description,
      kingdom: RABBIT_BLUEPRINT.kingdom,
      tags: RABBIT_BLUEPRINT.tags,
      stubColor: RABBIT_BLUEPRINT.stubColor,
      body: RABBIT_BLUEPRINT.body,
      brain: RABBIT_BLUEPRINT.brain,
      spine: { instanceId: 'spine', spine: 'differential-drive' },
      wiring: RABBIT_BLUEPRINT.wiring,
      metabolism: RABBIT_BLUEPRINT.metabolism,
      diet: RABBIT_BLUEPRINT.diet,
      lifecycle: RABBIT_BLUEPRINT.lifecycle,
    };
    const overridden = validateAnimalBlueprint({
      ...scentless,
      ruleOverrides: [
        {
          ruleId: 'max-sensors-per-creature',
          params: { max: 8 },
          reason: 'Test species override',
        },
      ],
    });
    expect(overridden.ruleReport.ok).toBe(true);
    const scentlessId = spawnSpeciesEntity(world, scentless, { x: 14, y: 14 });
    expect(world.ecs.isAlive(scentlessId)).toBe(true);

    // Removing multi-body creature cleans up all bodies/joints without leaks
    const beforeBodies = world.physics.getStats().bodyCount;
    world.removeEntity(rabbitId);
    expect(world.physics.getStats().bodyCount).toBeLessThan(beforeBodies);

    // Unknown sensor throws BlueprintValidationError
    const badSensor: AnimalSpeciesBlueprint = {
      ...RABBIT_BLUEPRINT,
      body: {
        parts: [
          {
            id: 'torso',
            shape: { type: 'circle', r: 0.2 },
            sensors: [{ instanceId: 'x', sensor: 'unknown-sensor' }],
          },
        ],
      },
    };
    expect(() => validateAnimalBlueprint(badSensor)).toThrow(BlueprintValidationError);

    // Unknown actuator throws BlueprintValidationError
    const badActuator: AnimalSpeciesBlueprint = {
      ...RABBIT_BLUEPRINT,
      body: {
        parts: [
          {
            id: 'torso',
            shape: { type: 'circle', r: 0.2 },
            actuator: { instanceId: 'x', actuator: 'unknown-actuator' },
          },
        ],
      },
    };
    expect(() => validateAnimalBlueprint(badActuator)).toThrow(BlueprintValidationError);

    // Unknown brain module throws BlueprintValidationError
    const badBrain: AnimalSpeciesBlueprint = {
      ...RABBIT_BLUEPRINT,
      brain: {
        modules: [{ instanceId: 'bad', module: 'nonexistent-module' }],
      },
    };
    expect(() => validateAnimalBlueprint(badBrain)).toThrow(BlueprintValidationError);

    // Unknown spine throws BlueprintValidationError
    const badSpine: AnimalSpeciesBlueprint = {
      ...RABBIT_BLUEPRINT,
      spine: { instanceId: 'spine', spine: 'nonexistent-spine' },
    };
    expect(() => validateAnimalBlueprint(badSpine)).toThrow(BlueprintValidationError);

    // Violating error-level rule (e.g. min-collider-size) rejects Blueprint
    const tinyPart: AnimalSpeciesBlueprint = {
      ...RABBIT_BLUEPRINT,
      body: {
        parts: [{ id: 'torso', shape: { type: 'circle', r: 0.001 } }],
      },
      brain: { modules: [] },
      wiring: [],
    };
    expect(() => validateAnimalBlueprint(tinyPart)).toThrow(BlueprintValidationError);

    world.free();
  });
});
