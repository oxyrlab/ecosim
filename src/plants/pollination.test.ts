import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import { parsePlantSpeciesSpec, PlantComponent } from './components';
import { stepPollinationSystem } from './pollination';
import { spawnPlant } from './spawn';

describe('pollination system', () => {
  it('pollinates nearby flowering plants of the same species and ignores distant or different species', () => {
    const world = new World(
      { seed: 7, widthMeters: 30, heightMeters: 30, gridCols: 15, gridRows: 15 },
      createMockPhysicsAdapter(),
    );
    const berrySpec = parsePlantSpeciesSpec({
      speciesId: 'berry-bush',
      pollinationRadiusMeters: 3,
      pollinationProbabilityPerSecond: 1,
      selfPollinationProbabilityPerSecond: 0,
    });
    const grassSpec = parsePlantSpeciesSpec({
      speciesId: 'grass',
      pollinationRadiusMeters: 3,
      pollinationProbabilityPerSecond: 1,
      selfPollinationProbabilityPerSecond: 0,
    });

    const a = spawnPlant(world, berrySpec, { x: 5, y: 5 }, { stage: 'flowering' });
    const b = spawnPlant(world, berrySpec, { x: 7, y: 5 }, { stage: 'flowering' });
    // Different species near isolated berry should NOT pollinate it
    const isolated = spawnPlant(world, berrySpec, { x: 20, y: 20 }, { stage: 'flowering' });
    spawnPlant(world, grassSpec, { x: 21, y: 20 }, { stage: 'flowering' });

    expect(stepPollinationSystem(world, 0)).toEqual([]);

    const result = stepPollinationSystem(world, 1);
    expect(result).toContain(a);
    expect(result).toContain(b);
    expect(result).not.toContain(isolated);
    expect(world.ecs.requireComponent(a, PlantComponent).pollinated).toBe(true);
    expect(world.ecs.requireComponent(isolated, PlantComponent).pollinated).toBe(false);

    // Self-pollinating species works even when isolated
    const selfSpec = parsePlantSpeciesSpec({
      speciesId: 'clover',
      pollinationProbabilityPerSecond: 0.5,
      selfPollinationProbabilityPerSecond: 1,
    });
    const clover = spawnPlant(world, selfSpec, { x: 15, y: 5 }, { stage: 'flowering' });
    expect(stepPollinationSystem(world, 0.5)).toContain(clover);

    expect(() => stepPollinationSystem(world, -0.1)).toThrow(InvalidParameterError);
    world.free();
  });
});
