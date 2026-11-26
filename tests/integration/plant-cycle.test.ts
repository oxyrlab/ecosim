import { describe, expect, it } from 'vitest';
import type { EntityId } from '@core/index';
import {
  computeWorldEnergy,
  DietComponent,
  EnergyComponent,
  EnergyLedger,
  HealthComponent,
  stepAgingSystem,
  stepDeathSystem,
  stepDecompositionSystem,
  stepHealthSystem,
  stepInteractionSystem,
  stepMetabolismSystem,
} from '@life/index';
import { createRapierPhysicsAdapter } from '@physics/rapier-adapter';
import {
  FruitComponent,
  parsePlantSpeciesSpec,
  PlantComponent,
  recordFruitBites,
  spawnPlant,
  stepFruitSystem,
  stepPhotosynthesisSystem,
  stepPlantLifecycleSystem,
  stepPollinationSystem,
  stepSeedDispersalSystem,
} from '@plants/index';
import { PhysicsBodyComponent, TransformComponent, World } from '@world/index';

describe('plant lifecycle and closed nutrient loop (real Rapier WASM)', () => {
  it('runs full plant cycle (seed -> sprout -> mature -> flowering -> pollination -> fruit -> new seed -> death -> soil.nutrients) with exact EnergyLedger balance and zero handle leaks', async () => {
    const physics = await createRapierPhysicsAdapter();
    const world = new World(
      { seed: 101, widthMeters: 30, heightMeters: 30, gridCols: 15, gridRows: 15 },
      physics,
    );
    const ledger = new EnergyLedger();

    // Rich soil nutrients across the patch
    world.fields.paintField('soil.nutrients', 15, 15, 8, 25, 'add');

    const spec = parsePlantSpeciesSpec({
      speciesId: 'berry-bush',
      seedRadius: 0.08,
      adultRadius: 0.4,
      maxEnergy: 60,
      seedEnergy: 4,
      structuralEnergy: 4,
      basalRatePerKgPerSecond: 0.04,
      photosynthesisRatePerArea: 10,
      nutrientFraction: 0.25,
      germinationDelaySeconds: 0.5,
      sproutToMatureAgeSeconds: 2,
      sproutToMatureEnergy: 12,
      matureToFloweringAgeSeconds: 3.5,
      matureToFloweringEnergy: 20,
      senescenceAgeSeconds: 11,
      maxAgeSeconds: 13,
      pollinationRadiusMeters: 5,
      pollinationProbabilityPerSecond: 0.9,
      selfPollinationProbabilityPerSecond: 0,
      fruitFleshEnergy: 6,
      fruitLifespanSeconds: 2,
      fruitGerminationProbability: 1,
      maxFruitsPerCycle: 1,
    });

    const p1 = spawnPlant(world, spec, { x: 14, y: 15 }, { stage: 'seed' });
    const p2 = spawnPlant(world, spec, { x: 16.5, y: 15 }, { stage: 'seed' });
    ledger.recordInitialSpawn(computeWorldEnergy(world));

    let sawSprout = false;
    let sawMature = false;
    let sawFlowering = false;
    let sawFruit = false;
    let sawNewSeed = false;
    let maxObservedRadius = spec.seedRadius;

    const dt = 0.25;
    for (let step = 0; step < 65; step += 1) {
      stepPhotosynthesisSystem(world, dt, ledger);
      stepAgingSystem(world, dt);
      stepMetabolismSystem(world, dt, ledger);
      stepPlantLifecycleSystem(world, dt);
      stepPollinationSystem(world, dt);
      const fruitRes = stepFruitSystem(world, dt, ledger);
      stepSeedDispersalSystem(world, dt);
      stepHealthSystem(world, dt);
      stepDeathSystem(world, ledger, { defaultCorpseDecayRatePerSecond: 10 });
      stepDecompositionSystem(world, dt, ledger);
      world.physics.step(dt);

      if (world.ecs.isAlive(p1)) {
        const st = world.ecs.requireComponent(p1, PlantComponent).stage;
        if (st === 'sprout') sawSprout = true;
        if (st === 'mature') sawMature = true;
        if (st === 'flowering') sawFlowering = true;
        const r = world.ecs.requireComponent(p1, PhysicsBodyComponent).boundingRadius;
        if (r > maxObservedRadius) maxObservedRadius = r;
      }
      if (fruitRes.spawnedFruits.length > 0) sawFruit = true;
      if (fruitRes.droppedSeeds.length > 0) sawNewSeed = true;

      // Exact conservation holds on EVERY tick
      const audit = ledger.audit(computeWorldEnergy(world), 1e-2);
      expect(audit.balanced).toBe(true);
    }

    expect(sawSprout).toBe(true);
    expect(sawMature).toBe(true);
    expect(sawFlowering).toBe(true);
    expect(sawFruit).toBe(true);
    expect(sawNewSeed).toBe(true);
    expect(maxObservedRadius).toBeCloseTo(spec.adultRadius, 2);

    // Original parents aged out and decomposed; second-generation plants remain alive
    expect(world.ecs.isAlive(p1)).toBe(false);
    expect(world.ecs.isAlive(p2)).toBe(false);
    const remainingPlants = world.ecs.query(PlantComponent);
    expect(remainingPlants.length).toBeGreaterThan(0);

    // Zero Rapier handle leaks: active physics bodies === 4 boundary walls + alive entities with PhysicsBodyComponent
    const expectedBodies = 4 + world.ecs.query(PhysicsBodyComponent).length;
    expect(world.physics.getStats().bodyCount).toBe(expectedBodies);
    expect(world.physics.getStats().colliderCount).toBe(expectedBodies);

    world.free();
  });

  it('disperses fruit seed via herbivore eating and closes the nutrient loop back into soil', async () => {
    const physics = await createRapierPhysicsAdapter();
    const world = new World(
      { seed: 202, widthMeters: 30, heightMeters: 30, gridCols: 15, gridRows: 15 },
      physics,
    );
    const ledger = new EnergyLedger();

    const spec = parsePlantSpeciesSpec({
      speciesId: 'berry-bush',
      fruitFleshEnergy: 8,
      seedEnergy: 4,
      dispersalDelaySeconds: 1.5,
      germinationDelaySeconds: 0.5,
      maxFruitsPerCycle: 1,
    });

    const bush = spawnPlant(world, spec, { x: 5, y: 5 }, { stage: 'fruiting', initialEnergy: 30 });
    const herbivore = world.spawnSimpleBody({
      position: { x: 5, y: 5 },
      radius: 0.3,
      tags: ['prey', 'herbivore'],
    });
    world.ecs.addComponent(herbivore, EnergyComponent, {
      current: 15,
      max: 100,
      massKg: 1,
      basalRatePerKgPerSecond: 0.2,
      brainUpkeepPerSecond: 0.05,
      pendingActuatorCost: 0,
      starvationDamagePerSecond: 5,
      structuralEnergy: 8,
    });
    world.ecs.addComponent(herbivore, DietComponent, {
      assimilationEfficiency: 0.75,
      edibleTags: ['fruit', 'plant'],
    });
    world.ecs.addComponent(herbivore, HealthComponent, {
      current: 20,
      max: 20,
      pendingDamage: 0,
      recentPainPulse: 0,
      dead: false,
      deathCause: 'none',
      energyPerDamage: 1,
    });

    ledger.recordInitialSpawn(computeWorldEnergy(world));

    // Step fruit spawn
    const spawned = stepFruitSystem(world, 0.2, ledger);
    expect(spawned.spawnedFruits).toHaveLength(1);
    const fruitId = spawned.spawnedFruits[0] as EntityId;
    const fruitPos = world.ecs.requireComponent(fruitId, TransformComponent);

    // Move herbivore right next to the fruit and bite it completely
    world.physics.setBodyTransform(
      world.ecs.requireComponent(herbivore, PhysicsBodyComponent).bodyHandle,
      { x: fruitPos.x - 0.3, y: fruitPos.y },
      0,
    );
    world.syncFromPhysics();

    const bites = stepInteractionSystem(
      world,
      [
        {
          kind: 'bite',
          actorEntityId: herbivore,
          origin: { x: fruitPos.x - 0.15, y: fruitPos.y },
          direction: { x: 1, y: 0 },
          rangeMeters: 0.8,
          damage: 10,
        },
      ],
      ledger,
    );
    recordFruitBites(world, bites);
    expect(world.ecs.requireComponent(fruitId, FruitComponent).eatenBy).toBe(herbivore);

    // Fruit hands seed to herbivore
    const afterEat = stepFruitSystem(world, 0.2, ledger);
    expect(afterEat.ingestedSeeds).toHaveLength(1);
    expect(world.ecs.isAlive(fruitId)).toBe(false);
    expect(ledger.audit(computeWorldEnergy(world), 1e-2).balanced).toBe(true);

    // Herbivore travels across the map to cell center (21, 21) before excreting the seed
    world.physics.setBodyTransform(
      world.ecs.requireComponent(herbivore, PhysicsBodyComponent).bodyHandle,
      { x: 21, y: 21 },
      0,
    );
    world.syncFromPhysics();

    const deposited = stepSeedDispersalSystem(world, 2);
    expect(deposited).toHaveLength(1);
    const dispersedSeed = deposited[0] as EntityId;
    const seedPos = world.ecs.requireComponent(dispersedSeed, TransformComponent);
    expect(Math.hypot(seedPos.x - 21, seedPos.y - 21)).toBeLessThan(0.5);

    // Herbivore dies at (21, 21) -> decomposes into soil.nutrients -> dispersed seed sprouts & grows!
    world.ecs.requireComponent(herbivore, HealthComponent).dead = true;
    stepDeathSystem(world, ledger, { defaultCorpseDecayRatePerSecond: 20 });
    stepDecompositionSystem(world, 2, ledger);
    expect(world.fields.get('soil.nutrients').sampleBilinear(21, 21)).toBeGreaterThan(0);

    // Dispersed seed germinates and photosynthesizes using the recycled soil nutrients
    stepPlantLifecycleSystem(world, 1);
    expect(world.ecs.requireComponent(dispersedSeed, PlantComponent).stage).toBe('sprout');
    const beforePhoto = world.ecs.requireComponent(dispersedSeed, EnergyComponent).current;
    stepPhotosynthesisSystem(world, 1, ledger);
    expect(world.ecs.requireComponent(dispersedSeed, EnergyComponent).current).toBeGreaterThan(
      beforePhoto,
    );

    // Bush still alive, total world energy strictly balanced with EnergyLedger
    expect(world.ecs.isAlive(bush)).toBe(true);
    expect(ledger.audit(computeWorldEnergy(world), 1e-2).balanced).toBe(true);
    world.free();
  });
});
