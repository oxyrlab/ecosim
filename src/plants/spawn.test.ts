import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { computeWorldEnergy, EnergyComponent } from '@life/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { PhysicsBodyComponent, TagsComponent, World } from '@world/index';
import { FruitComponent, parsePlantSpeciesSpec, PlantComponent } from './components';
import {
  computeInitialPlantMorphology,
  spawnFruit,
  spawnPlant,
  syncPlantVisualsAndTags,
} from './spawn';

describe('plant and fruit spawners', () => {
  it('spawns plants in every stage, carried seeds without physics bodies, and fruits with exact energy', () => {
    const world = new World(
      { seed: 1, widthMeters: 20, heightMeters: 20, gridCols: 10, gridRows: 10 },
      createMockPhysicsAdapter(),
    );
    const spec = parsePlantSpeciesSpec({ speciesId: 'berry-bush' });

    const stages = ['seed', 'sprout', 'mature', 'flowering', 'fruiting', 'senescence'] as const;
    for (const stage of stages) {
      const m = computeInitialPlantMorphology(spec, stage);
      expect(m.radius).toBeGreaterThan(0);
      const id = spawnPlant(world, spec, { x: 5, y: 5 }, { stage });
      const plant = world.ecs.requireComponent(id, PlantComponent);
      expect(plant.kingdom).toBe('plant');
      expect(plant.stage).toBe(stage);
      expect(world.ecs.hasComponent(id, PhysicsBodyComponent)).toBe(true);
      expect(world.ecs.requireComponent(id, TagsComponent).values.has('plant')).toBe(true);
      syncPlantVisualsAndTags(world, id, stage);
      world.removeEntity(id);
    }

    // Carried seed has EnergyComponent (so EnergyLedger tracks it) but no physics body
    const carrier = world.spawnSimpleBody({ position: { x: 8, y: 8 }, radius: 0.3 });
    const carriedSeed = spawnPlant(
      world,
      spec,
      { x: 8, y: 8 },
      { stage: 'seed', carriedBy: carrier, dispersalRemainingSeconds: 3 },
    );
    expect(world.ecs.hasComponent(carriedSeed, PhysicsBodyComponent)).toBe(false);
    expect(world.ecs.requireComponent(carriedSeed, EnergyComponent).current).toBeCloseTo(
      spec.seedEnergy,
    );
    expect(computeWorldEnergy(world)).toBeCloseTo(spec.seedEnergy);

    // Fruit carries flesh energy + internal seed energy in structuralEnergy
    const fruit = spawnFruit(world, spec, { x: 10, y: 10 }, 8, 4);
    expect(world.ecs.requireComponent(fruit, FruitComponent).seedEnergy).toBe(4);
    expect(world.ecs.requireComponent(fruit, TagsComponent).values.has('fruit')).toBe(true);
    expect(computeWorldEnergy(world)).toBeCloseTo(spec.seedEnergy + 12);

    expect(() => spawnFruit(world, spec, { x: 10, y: 10 }, -1, 4)).toThrow(InvalidParameterError);
    expect(() => spawnFruit(world, spec, { x: 10, y: 10 }, 4, 0)).toThrow(InvalidParameterError);

    world.free();
  });
});
