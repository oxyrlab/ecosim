import { describe, expect, it } from 'vitest';
import { computeWorldEnergy, EnergyComponent, EnergyLedger } from '@life/index';
import { createRapierPhysicsAdapter } from '@physics/rapier-adapter';
import { FruitComponent, PlantComponent } from '@plants/index';
import {
  BERRY_BUSH_BLUEPRINT,
  computeWorldStateHash,
  CreatureBrainComponent,
  FOX_BLUEPRINT,
  GRASS_BLUEPRINT,
  RABBIT_BLUEPRINT,
  spawnSpeciesEntity,
  stepEcosystemTick,
} from '@species/index';
import { PhysicsBodyComponent, TransformComponent, World } from '@world/index';

async function runBalancedEcosystem(seed: number, ticks: number) {
  const physics = await createRapierPhysicsAdapter();
  const world = new World(
    { seed, widthMeters: 36, heightMeters: 36, gridCols: 18, gridRows: 18 },
    physics,
  );
  const ledger = new EnergyLedger();

  // Nutrient-rich meadow
  world.fields.paintField('soil.nutrients', 18, 18, 18, 18, 'add');

  // Plants: meadow grass & fruiting berry bushes
  const grassPositions = [
    { x: 8, y: 10 },
    { x: 11, y: 11 },
    { x: 14, y: 9 },
    { x: 18, y: 14 },
    { x: 22, y: 12 },
    { x: 15, y: 20 },
  ];
  for (const pos of grassPositions) {
    spawnSpeciesEntity(world, GRASS_BLUEPRINT, pos, {
      plantOptions: { stage: 'mature', initialEnergy: 20 },
    });
  }

  const bushPositions = [
    { x: 10, y: 18 },
    { x: 13, y: 18 },
    { x: 24, y: 20 },
    { x: 26, y: 21 },
  ];
  for (const pos of bushPositions) {
    spawnSpeciesEntity(world, BERRY_BUSH_BLUEPRINT, pos, {
      plantOptions: { stage: 'flowering', initialEnergy: 42 },
    });
  }

  // Animals: rabbits (herbivores) and foxes (predators)
  const rabbitIds = [
    spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 9.5, y: 11 }, { angle: 0.2 }),
    spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 16, y: 15 }, { angle: 1.1 }),
    spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 21, y: 14 }, { angle: -0.6 }),
  ];
  const foxIds = [spawnSpeciesEntity(world, FOX_BLUEPRINT, { x: 28, y: 26 }, { angle: Math.PI })];

  ledger.recordInitialSpawn(computeWorldEnergy(world));

  const dt = 1 / 30;
  let totalBites = 0;
  let totalFruits = 0;

  for (let i = 0; i < ticks; i += 1) {
    const res = stepEcosystemTick(world, dt, ledger);
    totalBites += res.bites.length;
    totalFruits += res.fruits.spawnedFruits.length;
  }

  // Assert zero NaN / Infinity across all transforms, energies, buses, and fields
  for (const entity of world.ecs.query(TransformComponent)) {
    const t = world.ecs.requireComponent(entity, TransformComponent);
    expect(Number.isFinite(t.x)).toBe(true);
    expect(Number.isFinite(t.y)).toBe(true);
    expect(Number.isFinite(t.angle)).toBe(true);
  }
  for (const entity of world.ecs.query(EnergyComponent)) {
    const e = world.ecs.requireComponent(entity, EnergyComponent);
    expect(Number.isFinite(e.current)).toBe(true);
    expect(e.current).toBeGreaterThanOrEqual(0);
  }
  for (const entity of world.ecs.query(CreatureBrainComponent)) {
    const bus = world.ecs.requireComponent(entity, CreatureBrainComponent).bus;
    for (let i = 0; i < bus.channelCount; i += 1) {
      expect(Number.isFinite(bus.readIndex(i))).toBe(true);
    }
  }
  for (const name of world.fields.names()) {
    expect(Number.isFinite(world.fields.get(name).totalMass())).toBe(true);
  }

  const audit = ledger.audit(computeWorldEnergy(world), 1e-2);
  const hash = computeWorldStateHash(world);
  const plantCount = world.ecs.query(PlantComponent).length;
  const fruitCount = world.ecs.query(FruitComponent).length;
  const animalCount = world.ecs.query(CreatureBrainComponent).length;

  // Verify Rapier physics body/joint count matches live ECS entities exactly (zero handle leaks)
  let expectedBodies = 4; // 4 boundary walls
  let expectedJoints = 0;
  for (const entity of world.ecs.query(PhysicsBodyComponent)) {
    const b = world.ecs.requireComponent(entity, PhysicsBodyComponent);
    expectedBodies += 1 + (b.extraBodyHandles?.length ?? 0);
    expectedJoints += b.jointHandles.length;
  }
  const stats = world.physics.getStats();
  expect(stats.bodyCount).toBe(expectedBodies);
  expect(stats.jointCount).toBe(expectedJoints);

  const rabbitsMoved = rabbitIds.some((id) => {
    if (!world.ecs.isAlive(id)) return true;
    const t = world.ecs.requireComponent(id, TransformComponent);
    return Math.hypot(t.x - 9.5, t.y - 11) > 0.2;
  });
  const foxMoved = foxIds.some((id) => {
    if (!world.ecs.isAlive(id)) return true;
    const t = world.ecs.requireComponent(id, TransformComponent);
    return Math.hypot(t.x - 28, t.y - 26) > 0.2;
  });

  world.free();

  return {
    audit,
    hash,
    plantCount,
    fruitCount,
    animalCount,
    totalBites,
    totalFruits,
    rabbitsMoved,
    foxMoved,
  };
}

describe('Phase 5 balanced first-ecosystem scenario (real Rapier WASM)', () => {
  it('runs grass + berry-bush + rabbit + fox deterministically with exact EnergyLedger balance and zero NaNs', async () => {
    const runA = await runBalancedEcosystem(2026, 240); // 8 seconds at 30 Hz
    const runB = await runBalancedEcosystem(2026, 240);

    expect(runA.hash).toBe(runB.hash);
    expect(runA.audit.balanced).toBe(true);
    expect(runA.plantCount).toBeGreaterThanOrEqual(10);
    expect(runA.animalCount).toBeGreaterThan(0);
    expect(runA.rabbitsMoved).toBe(true);
    expect(runA.foxMoved).toBe(true);
    expect(runA.totalFruits).toBeGreaterThan(0);
  });

  it('exhibits emergent predator-prey flight and pursuit behavior', async () => {
    const physics = await createRapierPhysicsAdapter();
    const world = new World(
      { seed: 99, widthMeters: 30, heightMeters: 30, gridCols: 15, gridRows: 15 },
      physics,
    );
    const ledger = new EnergyLedger();

    // Place a fox facing a rabbit directly in front of it at 2.5m distance
    const rabbit = spawnSpeciesEntity(
      world,
      RABBIT_BLUEPRINT,
      { x: 15, y: 15 },
      { angle: Math.PI },
    );
    const fox = spawnSpeciesEntity(world, FOX_BLUEPRINT, { x: 12.5, y: 15 }, { angle: 0 });
    // Make fox hungry so hunt drive is high
    world.ecs.requireComponent(fox, EnergyComponent).current = 20;
    ledger.recordInitialSpawn(computeWorldEnergy(world));

    for (let i = 0; i < 60; i += 1) {
      stepEcosystemTick(world, 1 / 30, ledger);
    }

    // Rabbit detected predator and turned/fled away; fox accelerated rightward toward rabbit
    const foxPos = world.ecs.requireComponent(fox, TransformComponent);
    expect(foxPos.x).toBeGreaterThan(13);

    if (world.ecs.isAlive(rabbit)) {
      const rabbitSnap = world.ecs.requireComponent(rabbit, CreatureBrainComponent).bus.snapshot();
      expect(rabbitSnap['flee.hormone.adrenaline'] ?? 0).toBeGreaterThan(0);
    }

    expect(ledger.audit(computeWorldEnergy(world), 1e-2).balanced).toBe(true);
    world.free();
  });
});
