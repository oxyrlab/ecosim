import { describe, expect, it } from 'vitest';
import {
  ReproductionComponent,
  reproductionSpecSchema,
  stepReproductionSystem,
  type MutationSpec,
} from '@genome/index';
import { computeWorldEnergy, EnergyComponent, EnergyLedger, HealthComponent } from '@life/index';
import { createRapierPhysicsAdapter } from '@physics/rapier-adapter';
import {
  CreatureBrainComponent,
  defineSpecies,
  FOX_BLUEPRINT,
  RABBIT_BLUEPRINT,
  spawnSpeciesEntity,
  stepEcosystemTick,
  type AnimalSpeciesBlueprint,
} from '@species/index';
import { PhysicsBodyComponent, TransformComponent, World } from '@world/index';

/**
 * Rabbit variant equipped with appearance-feature vision (`features: true`) and the
 * `threat-memory` learning module wired into its `behavior-arbiter`.
 */
const LEARNING_RABBIT_BLUEPRINT: AnimalSpeciesBlueprint = defineSpecies({
  ...RABBIT_BLUEPRINT,
  id: 'learning-rabbit',
  name: 'Learning Rabbit',
  body: {
    parts: RABBIT_BLUEPRINT.body.parts.map((part) =>
      part.id === 'head'
        ? {
            ...part,
            sensors: [
              {
                instanceId: 'eyes',
                sensor: 'vision-sensor',
                params: {
                  rangeMeters: 9,
                  fovRadians: Math.PI * 1.25,
                  sectors: 6,
                  tags: ['plant', 'fruit', 'predator'],
                  features: true,
                },
              },
              {
                instanceId: 'nose',
                sensor: 'olfactory-sensor',
                params: {
                  channels: ['scent.plant', 'scent.predator'],
                  antennaSpreadMeters: 0.18,
                  maxIntensity: 6,
                },
              },
            ],
          }
        : part,
    ),
  },
  brain: {
    modules: [
      ...RABBIT_BLUEPRINT.brain.modules.filter((m) => m.instanceId !== 'arbiter'),
      {
        instanceId: 'threat',
        module: 'threat-memory',
        params: { learningRate: 0.45, memorySlots: 8, minLearnIntervalSeconds: 0.1 },
      },
      {
        instanceId: 'arbiter',
        module: 'behavior-arbiter',
        params: {
          slots: ['flee', 'threat', 'forage', 'wander'],
          weights: { flee: 1.8, threat: 1.7, forage: 1.1 },
        },
      },
    ],
  },
  wiring: [
    ...RABBIT_BLUEPRINT.wiring,
    { from: 'eyes:nearest.seen', to: 'threat:nearest.seen' },
    { from: 'eyes:nearest.dir', to: 'threat:nearest.dir' },
    { from: 'eyes:nearest.size', to: 'threat:nearest.size' },
    { from: 'eyes:nearest.hue', to: 'threat:nearest.hue' },
    { from: 'eyes:nearest.lightness', to: 'threat:nearest.lightness' },
    { from: 'eyes:nearest.shape', to: 'threat:nearest.shape' },
    { from: 'eyes:nearest.parts', to: 'threat:nearest.parts' },
    { from: 'pain:pain', to: 'threat:pain' },
    { bundle: 'behavior', from: 'threat', to: 'arbiter:threat' },
  ],
});

/**
 * Predator species WITHOUT the `'predator'` tag (Section 9.4 learned-fear test).
 * Visually distinct (large crimson triangle) so `threat-memory` recognizes it by appearance alone.
 */
const UNTAGGED_HUNTER_BLUEPRINT: AnimalSpeciesBlueprint = defineSpecies({
  ...FOX_BLUEPRINT,
  id: 'untagged-hunter',
  name: 'Untagged Hunter',
  tags: ['animal', 'stranger'],
  scentEmission: { field: 'scent.prey', ratePerSecond: 0 },
});

describe('Phase 6 evolution, reproduction, and learned fear (real Rapier WASM)', () => {
  it('learns to flee an untagged predator after being bitten, while reproduced offspring starts with empty memory', async () => {
    const physics = await createRapierPhysicsAdapter();
    const world = new World(
      { seed: 777, widthMeters: 30, heightMeters: 30, gridCols: 15, gridRows: 15 },
      physics,
    );
    const ledger = new EnergyLedger();

    // Spawn learning rabbit facing right toward an UNTAGGED hunter
    const rabbit = spawnSpeciesEntity(
      world,
      LEARNING_RABBIT_BLUEPRINT,
      { x: 10, y: 15 },
      { angle: 0 },
    );
    const hunter = spawnSpeciesEntity(
      world,
      UNTAGGED_HUNTER_BLUEPRINT,
      { x: 12, y: 15 },
      { angle: Math.PI },
    );
    const rabbitEnergy = world.ecs.requireComponent(rabbit, EnergyComponent);
    rabbitEnergy.current = 75;
    ledger.recordInitialSpawn(computeWorldEnergy(world));

    // Before being bitten, rabbit sees untagged hunter -> zero learned fear (no 'predator' tag!)
    for (let i = 0; i < 4; i += 1) {
      stepEcosystemTick(world, 0.1, ledger);
    }
    const beforeSnap = world.ecs.requireComponent(rabbit, CreatureBrainComponent).bus.snapshot();
    expect(beforeSnap['threat.predictedDanger'] ?? 0).toBe(0);

    // Simulate 3 bite/pain episodes while the rabbit faces the untagged hunter at ~4.2 m distance
    const rabbitHealth = world.ecs.requireComponent(rabbit, HealthComponent);
    const rabbitBody = world.ecs.requireComponent(rabbit, PhysicsBodyComponent).bodyHandle;
    const hunterBody = world.ecs.requireComponent(hunter, PhysicsBodyComponent).bodyHandle;
    for (let ep = 0; ep < 3; ep += 1) {
      world.physics.setBodyTransform(rabbitBody, { x: 10, y: 15 }, 0);
      world.physics.setBodyTransform(hunterBody, { x: 14.2, y: 15 }, Math.PI);
      world.syncFromPhysics();
      stepEcosystemTick(world, 0.12, ledger);
      rabbitHealth.pendingDamage = 4;
      stepEcosystemTick(world, 0.12, ledger);
      stepEcosystemTick(world, 0.12, ledger);
    }

    // Re-present the untagged hunter in front of the conditioned rabbit -> high danger & fleeing turn!
    world.physics.setBodyTransform(rabbitBody, { x: 10, y: 15 }, 0);
    world.physics.setBodyTransform(hunterBody, { x: 14.2, y: 15 }, Math.PI);
    world.syncFromPhysics();
    stepEcosystemTick(world, 0.05, ledger);
    stepEcosystemTick(world, 0.05, ledger);

    const afterSnap = world.ecs.requireComponent(rabbit, CreatureBrainComponent).bus.snapshot();
    expect(afterSnap['threat.predictedDanger'] ?? 0).toBeGreaterThan(0.5);
    expect(Math.abs(afterSnap['threat.dangerTurn'] ?? 0)).toBeGreaterThan(0.5);

    // Parent reproduces asexually with mutation -> offspring inherits valid mutated Blueprint
    // AND starts with completely empty threat-memory (learned memory is NOT inherited!)
    const mutation: MutationSpec = {
      rate: 1,
      mutable: [{ path: 'metabolism.basalRatePerKgPerSecond', min: 0.15, max: 0.8, sigma: 0.08 }],
    };
    const topUpEnergy = Math.max(0, 75 - rabbitEnergy.current);
    rabbitEnergy.current += topUpEnergy;
    ledger.recordInitialSpawn(topUpEnergy);
    world.ecs.addComponent(rabbit, ReproductionComponent, {
      speciesId: 'learning-rabbit',
      blueprint: LEARNING_RABBIT_BLUEPRINT,
      spec: reproductionSpecSchema.parse({
        mode: 'asexual',
        minEnergyToReproduce: 50,
        offspringEnergy: 20,
        overheadCost: 4,
        cooldownSeconds: 10,
      }),
      mutation,
      cooldownRemainingSeconds: 0,
      generation: 0,
      offspringCount: 0,
    });

    const births = stepReproductionSystem(world, 0.1, ledger);
    expect(births).toHaveLength(1);
    const offspringId = births[0]?.offspringId;
    expect(offspringId).toBeDefined();

    if (offspringId !== undefined) {
      // Point offspring directly at the same untagged hunter
      const offBody = world.ecs.requireComponent(offspringId, PhysicsBodyComponent).bodyHandle;
      world.physics.setBodyTransform(offBody, { x: 10, y: 16 }, 0);
      world.physics.setBodyTransform(hunterBody, { x: 12, y: 16 }, Math.PI);
      world.syncFromPhysics();
      const hunterPos = world.ecs.requireComponent(hunter, TransformComponent);
      const offPos = world.ecs.requireComponent(offspringId, TransformComponent);
      expect(Math.hypot(offPos.x - hunterPos.x, offPos.y - hunterPos.y)).toBeGreaterThan(0);

      // Step twice so vision -> threat-memory completes: offspring has empty memory (0 danger)
      stepEcosystemTick(world, 0.05, ledger);
      stepEcosystemTick(world, 0.05, ledger);
      const offBrain = world.ecs.requireComponent(offspringId, CreatureBrainComponent);
      const offThreat = offBrain.brainModules.find((m) => m.instanceId === 'threat');
      const offState = offThreat?.instance.serialize?.() as { totalLearnUpdates: number };
      expect(offState.totalLearnUpdates).toBe(0);
      expect(offBrain.bus.snapshot()['threat.predictedDanger'] ?? 0).toBe(0);
    }

    expect(ledger.audit(computeWorldEnergy(world), 1e-1).balanced).toBe(true);
    world.free();
  });
});
