import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { computeWorldEnergy, EnergyComponent, EnergyLedger, HealthComponent } from '@life/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import { parsePlantSpeciesSpec } from './components';
import { stepPhotosynthesisSystem } from './photosynthesis';
import { spawnPlant } from './spawn';

describe('photosynthesis system', () => {
  it('harvests light and soil nutrients in exact EnergyLedger balance and emits plant scent', () => {
    const world = new World(
      { seed: 1, widthMeters: 10, heightMeters: 10, gridCols: 5, gridRows: 5 },
      createMockPhysicsAdapter(),
    );
    const ledger = new EnergyLedger();

    // Seed soil nutrients at plant location (5, 5)
    world.fields.get('soil.nutrients').addAtWorld(5, 5, 20);

    const spec = parsePlantSpeciesSpec({
      speciesId: 'herb',
      photosynthesisRatePerArea: 8,
      nutrientFraction: 0.25,
      maxEnergy: 60,
    });
    const plant = spawnPlant(world, spec, { x: 5, y: 5 }, { stage: 'mature', initialEnergy: 10 });
    // Seeds and senescent plants should not photosynthesize
    const seed = spawnPlant(world, spec, { x: 2, y: 2 }, { stage: 'seed' });
    const old = spawnPlant(world, spec, { x: 8, y: 8 }, { stage: 'senescence', initialEnergy: 5 });

    ledger.recordInitialSpawn(computeWorldEnergy(world));

    stepPhotosynthesisSystem(world, 0, ledger); // dt = 0 no-op
    stepPhotosynthesisSystem(world, 1, ledger);

    const plantEnergy = world.ecs.requireComponent(plant, EnergyComponent).current;
    expect(plantEnergy).toBeGreaterThan(10);
    expect(world.fields.get('soil.nutrients').totalMass()).toBeLessThan(20);
    expect(world.fields.get('scent.plant').totalMass()).toBeGreaterThan(0);
    expect(world.ecs.requireComponent(seed, EnergyComponent).current).toBeCloseTo(spec.seedEnergy);
    expect(world.ecs.requireComponent(old, EnergyComponent).current).toBeCloseTo(5);

    // Exact EnergyLedger conservation: solar inflow accounted, soil transfer internal
    expect(ledger.snapshot().lightInput).toBeGreaterThan(0);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // Zero-nutrient soil halts nutrient-dependent growth
    world.fields.get('soil.nutrients').fill(0);
    const beforeDepleted = world.ecs.requireComponent(plant, EnergyComponent).current;
    stepPhotosynthesisSystem(world, 1, ledger);
    expect(world.ecs.requireComponent(plant, EnergyComponent).current).toBeCloseTo(beforeDepleted);

    // Dead plant does not photosynthesize, and pure-solar (nutrientFraction=0) works without soil
    world.ecs.requireComponent(plant, HealthComponent).dead = true;
    const solarSpec = parsePlantSpeciesSpec({
      speciesId: 'algae',
      nutrientFraction: 0,
      minLightToGrow: 0.2,
    });
    const solarPlant = spawnPlant(
      world,
      solarSpec,
      { x: 3, y: 3 },
      { stage: 'mature', initialEnergy: 5 },
    );
    const solarLedger = new EnergyLedger();
    solarLedger.recordInitialSpawn(computeWorldEnergy(world));
    stepPhotosynthesisSystem(world, 1, solarLedger);
    expect(world.ecs.requireComponent(solarPlant, EnergyComponent).current).toBeGreaterThan(5);
    expect(solarLedger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // Dark world stops photosynthesis
    world.fields.get('light').fill(0);
    const beforeDark = world.ecs.requireComponent(solarPlant, EnergyComponent).current;
    stepPhotosynthesisSystem(world, 1, solarLedger);
    expect(world.ecs.requireComponent(solarPlant, EnergyComponent).current).toBeCloseTo(beforeDark);

    // Plant at maxEnergy or with 0 leafArea or 0 scent rate safely skips without error
    world.fields.get('light').fill(1);
    const fullSpec = parsePlantSpeciesSpec({
      speciesId: 'full-herb',
      nutrientFraction: 0,
      plantScentRatePerSecond: 0,
      maxEnergy: 10,
    });
    const fullPlant = spawnPlant(
      world,
      fullSpec,
      { x: 7, y: 7 },
      { stage: 'mature', initialEnergy: 10 },
    );
    stepPhotosynthesisSystem(world, 1);
    expect(world.ecs.requireComponent(fullPlant, EnergyComponent).current).toBe(10);

    expect(() => stepPhotosynthesisSystem(world, -1)).toThrow(InvalidParameterError);
    expect(() => stepPhotosynthesisSystem(world, 1, ledger, 0)).toThrow(InvalidParameterError);
    world.free();
  });
});
