import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { EnergyComponent, HealthComponent, LifecycleComponent, stepAgingSystem } from '@life/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { PhysicsBodyComponent, World } from '@world/index';
import { parsePlantSpeciesSpec, PlantComponent } from './components';
import { stepPlantLifecycleSystem } from './lifecycle';
import { spawnPlant } from './spawn';

describe('plant lifecycle system', () => {
  it('transitions seed -> sprout -> mature -> flowering -> fruiting -> mature -> senescence -> death and updates collider radius', () => {
    const world = new World(
      { seed: 1, widthMeters: 20, heightMeters: 20, gridCols: 10, gridRows: 10 },
      createMockPhysicsAdapter(),
    );
    const spec = parsePlantSpeciesSpec({
      speciesId: 'berry-bush',
      seedRadius: 0.08,
      adultRadius: 0.5,
      germinationDelaySeconds: 1,
      sproutToMatureAgeSeconds: 3,
      sproutToMatureEnergy: 10,
      matureToFloweringAgeSeconds: 5,
      matureToFloweringEnergy: 20,
      senescenceAgeSeconds: 10,
      maxAgeSeconds: 12,
      maxFruitsPerCycle: 1,
    });

    const id = spawnPlant(world, spec, { x: 10, y: 10 }, { stage: 'seed' });
    const plant = world.ecs.requireComponent(id, PlantComponent);
    const initialBodyRadius = world.ecs.requireComponent(id, PhysicsBodyComponent).boundingRadius;
    expect(initialBodyRadius).toBeCloseTo(0.08);

    // dt = 0 is a safe no-op
    stepPlantLifecycleSystem(world, 0);
    expect(plant.stage).toBe('seed');

    // Germinate after germinationDelaySeconds
    stepAgingSystem(world, 1.1);
    stepPlantLifecycleSystem(world, 1.1);
    expect(plant.stage).toBe('sprout');
    expect(world.ecs.requireComponent(id, EnergyComponent).basalRatePerKgPerSecond).toBeCloseTo(
      spec.basalRatePerKgPerSecond,
    );

    // Grow sprout organs and collider radius, then reach maturity
    world.ecs.requireComponent(id, EnergyComponent).current = 12;
    stepAgingSystem(world, 2);
    stepPlantLifecycleSystem(world, 2);
    expect(plant.stage).toBe('mature');
    expect(world.ecs.requireComponent(id, PhysicsBodyComponent).boundingRadius).toBeGreaterThan(
      initialBodyRadius,
    );

    // Reach adult radius and flower
    world.ecs.requireComponent(id, EnergyComponent).current = 25;
    stepAgingSystem(world, 2);
    stepPlantLifecycleSystem(world, 2);
    expect(plant.stage).toBe('flowering');
    expect(plant.organs.flowerCount).toBe(spec.maxFlowers);
    expect(world.ecs.requireComponent(id, PhysicsBodyComponent).boundingRadius).toBeCloseTo(
      spec.adultRadius,
    );

    // Pollination moves flowering -> fruiting
    plant.pollinated = true;
    stepPlantLifecycleSystem(world, 0.5);
    expect(plant.stage).toBe('fruiting');

    // Completing maxFruitsPerCycle returns fruiting -> mature
    plant.fruitsInCurrentCycle = 1;
    stepPlantLifecycleSystem(world, 0.5);
    expect(plant.stage).toBe('mature');

    // Reaching senescenceAgeSeconds enters senescence
    world.ecs.requireComponent(id, LifecycleComponent).ageSeconds = 10.5;
    stepPlantLifecycleSystem(world, 0.5);
    expect(plant.stage).toBe('senescence');
    expect(plant.organs.flowerCount).toBe(0);

    // Reaching maxAgeSeconds marks dead
    world.ecs.requireComponent(id, LifecycleComponent).ageSeconds = 12.1;
    stepPlantLifecycleSystem(world, 0.5);
    expect(world.ecs.requireComponent(id, HealthComponent).dead).toBe(true);
    expect(world.ecs.requireComponent(id, HealthComponent).deathCause).toBe('aging');

    // Crowded seed cannot germinate
    const crowdedSpec = parsePlantSpeciesSpec({
      speciesId: 'grass',
      germinationDelaySeconds: 0.5,
      crowdingRadiusMeters: 2,
      maxNeighborsToGerminate: 0,
    });
    spawnPlant(world, crowdedSpec, { x: 4, y: 4 }, { stage: 'mature' });
    const blockedSeed = spawnPlant(world, crowdedSpec, { x: 4.5, y: 4 }, { stage: 'seed' });
    stepPlantLifecycleSystem(world, 1);
    expect(world.ecs.requireComponent(blockedSeed, PlantComponent).stage).toBe('seed');

    expect(() => stepPlantLifecycleSystem(world, -1)).toThrow(InvalidParameterError);
    world.free();
  });
});
