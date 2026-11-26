import { describe, expect, it } from 'vitest';
import { InvalidParameterError, type EntityId } from '@core/index';
import {
  computeWorldEnergy,
  DietComponent,
  EnergyComponent,
  EnergyLedger,
  stepInteractionSystem,
} from '@life/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { World } from '@world/index';
import { parsePlantSpeciesSpec, PlantComponent } from './components';
import { recordFruitBites, stepFruitSystem } from './fruit';
import { spawnFruit, spawnPlant } from './spawn';

describe('fruit system', () => {
  it('spawns fruits conserving energy, hands seeds to eaters, and germinates or rots expired fruits cleanly', () => {
    const world = new World(
      { seed: 42, widthMeters: 20, heightMeters: 20, gridCols: 10, gridRows: 10 },
      createMockPhysicsAdapter(),
    );
    const ledger = new EnergyLedger();

    const spec = parsePlantSpeciesSpec({
      speciesId: 'berry-bush',
      fruitFleshEnergy: 6,
      seedEnergy: 4,
      fruitLifespanSeconds: 5,
      fruitGerminationProbability: 1,
      dispersalDelaySeconds: 3,
      maxFruitsPerCycle: 1,
    });

    const bush = spawnPlant(
      world,
      spec,
      { x: 10, y: 10 },
      { stage: 'fruiting', initialEnergy: 30 },
    );
    ledger.recordInitialSpawn(computeWorldEnergy(world));

    expect(stepFruitSystem(world, 0, ledger).spawnedFruits).toEqual([]);

    // Bush spawns 1 fruit transferring 10 EU (6 flesh + 4 seed)
    const step1 = stepFruitSystem(world, 1, ledger);
    expect(step1.spawnedFruits).toHaveLength(1);
    expect(world.ecs.requireComponent(bush, EnergyComponent).current).toBeCloseTo(20);
    expect(world.fields.get('scent.plant').totalMass()).toBeGreaterThan(0);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // Uneaten fruit expires after lifespan and drops a rooted seed (germinationProbability = 1)
    const step2 = stepFruitSystem(world, 5, ledger);
    expect(step2.droppedSeeds).toHaveLength(1);
    expect(world.fields.get('soil.nutrients').totalMass()).toBeCloseTo(6);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // Rot case: germinationProbability = 0 returns all fruit + seed energy to soil.nutrients
    const rotSpec = parsePlantSpeciesSpec({
      speciesId: 'rot-berry',
      fruitFleshEnergy: 5,
      seedEnergy: 3,
      fruitLifespanSeconds: 2,
      fruitGerminationProbability: 0,
    });
    const rotFruit = spawnFruit(world, rotSpec, { x: 4, y: 4 }, 5, 3);
    ledger.recordInitialSpawn(8);
    const step3 = stepFruitSystem(world, 3, ledger);
    expect(step3.rottedFruits).toContain(rotFruit);
    expect(world.ecs.isAlive(rotFruit)).toBe(false);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // Eaten fruit hands seed to herbivore eater for endozoochorous dispersal
    const eater = world.spawnSimpleBody({
      position: { x: 14, y: 14 },
      radius: 0.3,
      tags: ['herbivore'],
    });
    world.ecs.addComponent(eater, EnergyComponent, {
      current: 10,
      max: 100,
      massKg: 1,
      basalRatePerKgPerSecond: 0,
      brainUpkeepPerSecond: 0,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 0,
      structuralEnergy: 5,
    });
    world.ecs.addComponent(eater, DietComponent, {
      assimilationEfficiency: 0.8,
      edibleTags: ['fruit'],
    });
    const eatenFruit = spawnFruit(world, spec, { x: 14.3, y: 14 }, 6, 4);
    ledger.recordInitialSpawn(15 + 10);

    const bites = stepInteractionSystem(
      world,
      [
        {
          kind: 'bite',
          actorEntityId: eater,
          origin: { x: 14.1, y: 14 },
          direction: { x: 1, y: 0 },
          rangeMeters: 0.8,
          damage: 10,
        },
      ],
      ledger,
    );
    recordFruitBites(world, bites);
    const step4 = stepFruitSystem(world, 0.5, ledger);
    expect(step4.ingestedSeeds).toHaveLength(1);
    const carriedId = step4.ingestedSeeds[0] as EntityId;
    expect(world.ecs.requireComponent(carriedId, PlantComponent).carriedBy).toBe(eater);
    expect(world.ecs.isAlive(eatenFruit)).toBe(false);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // Fruit depleted without an eater (with tiny residual flesh) drops seed in place and recycles residual
    const orphanFruit = spawnFruit(world, spec, { x: 2, y: 2 }, 1e-7, 4);
    ledger.recordInitialSpawn(4 + 1e-7);
    const step5 = stepFruitSystem(world, 0.5, ledger);
    expect(step5.droppedSeeds).toHaveLength(1);
    expect(world.ecs.isAlive(orphanFruit)).toBe(false);
    expect(ledger.audit(computeWorldEnergy(world)).balanced).toBe(true);

    // recordFruitBites ignores zero-extraction bites and non-fruit targets; low-energy fruiting plant skips spawning
    const lowPlant = spawnPlant(
      world,
      spec,
      { x: 6, y: 6 },
      { stage: 'fruiting', initialEnergy: 2 },
    );
    recordFruitBites(world, [
      {
        actorEntityId: eater,
        targetEntityId: lowPlant,
        damageDealt: 1,
        energyExtracted: 0,
        energyAssimilated: 0,
        energyWasted: 0,
      },
      {
        actorEntityId: eater,
        targetEntityId: lowPlant,
        damageDealt: 1,
        energyExtracted: 1,
        energyAssimilated: 0.8,
        energyWasted: 0.2,
      },
    ]);
    expect(stepFruitSystem(world, 0.5).spawnedFruits).toEqual([]);

    expect(() => stepFruitSystem(world, -1)).toThrow(InvalidParameterError);
    expect(() => stepFruitSystem(world, 1, ledger, 0)).toThrow(InvalidParameterError);
    world.free();
  });
});
