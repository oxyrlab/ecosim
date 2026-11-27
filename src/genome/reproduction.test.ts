import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import {
  computeWorldEnergy,
  EnergyComponent,
  EnergyLedger,
  HealthComponent,
  LifecycleComponent,
} from '@life/index';
import { createMockPhysicsAdapter } from '@physics/mock-adapter';
import { spawnSpeciesEntity } from '@species/entity-factory';
import { RABBIT_BLUEPRINT } from '@species/rabbit/blueprint';
import { World } from '@world/index';
import type { MutationSpec } from './mutation';
import {
  ReproductionComponent,
  reproductionSpecSchema,
  stepReproductionSystem,
} from './reproduction';

describe('reproduction system (asexual & sexual)', () => {
  it('spawns valid mutated offspring in asexual and sexual modes while conserving exact EnergyLedger balance', () => {
    const world = new World(
      { seed: 33, widthMeters: 30, heightMeters: 30, gridCols: 15, gridRows: 15 },
      createMockPhysicsAdapter(),
    );
    const ledger = new EnergyLedger();

    const mutation: MutationSpec = {
      rate: 1,
      mutable: [{ path: 'metabolism.basalRatePerKgPerSecond', min: 0.15, max: 0.8, sigma: 0.1 }],
    };

    // 1. Asexual reproduction
    const asexualParent = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 8, y: 8 });
    world.ecs.requireComponent(asexualParent, EnergyComponent).current = 75;
    const asexualSpec = reproductionSpecSchema.parse({
      mode: 'asexual',
      minEnergyToReproduce: 50,
      offspringEnergy: 20,
      overheadCost: 4,
      cooldownSeconds: 10,
    });
    world.ecs.addComponent(asexualParent, ReproductionComponent, {
      speciesId: 'rabbit',
      blueprint: RABBIT_BLUEPRINT,
      spec: asexualSpec,
      mutation,
      cooldownRemainingSeconds: 0,
      generation: 0,
      offspringCount: 0,
    });
    ledger.recordInitialSpawn(computeWorldEnergy(world));

    const birthsA = stepReproductionSystem(world, 0.5, ledger);
    expect(birthsA).toHaveLength(1);
    expect(birthsA[0]?.mode).toBe('asexual');
    expect(birthsA[0]?.generation).toBe(1);
    expect(birthsA[0]?.offspringBlueprint.metabolism.basalRatePerKgPerSecond).not.toBe(
      RABBIT_BLUEPRINT.metabolism.basalRatePerKgPerSecond,
    );
    expect(ledger.audit(computeWorldEnergy(world), 1e-2).balanced).toBe(true);

    // Cooldown prevents immediate second birth
    expect(stepReproductionSystem(world, 1, ledger)).toEqual([]);

    // 2. Sexual reproduction between two nearby well-fed parents
    const parent1 = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 20, y: 20 });
    const parent2 = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 21, y: 20 });
    world.ecs.requireComponent(parent1, EnergyComponent).current = 70;
    world.ecs.requireComponent(parent2, EnergyComponent).current = 70;
    const sexualSpec = reproductionSpecSchema.parse({
      mode: 'sexual',
      minEnergyToReproduce: 40,
      offspringEnergy: 22,
      overheadCost: 6,
      cooldownSeconds: 10,
      mateRadiusMeters: 3,
    });
    for (const pid of [parent1, parent2]) {
      world.ecs.addComponent(pid, ReproductionComponent, {
        speciesId: 'rabbit',
        blueprint: RABBIT_BLUEPRINT,
        spec: sexualSpec,
        mutation,
        cooldownRemainingSeconds: 0,
        generation: 0,
        offspringCount: 0,
      });
    }
    ledger.recordInitialSpawn((70 + RABBIT_BLUEPRINT.metabolism.structuralEnergy) * 2);

    const birthsS = stepReproductionSystem(world, 0.5, ledger);
    expect(birthsS).toHaveLength(1);
    expect(birthsS[0]?.mode).toBe('sexual');
    expect(birthsS[0]?.parentIds).toHaveLength(2);
    expect(ledger.audit(computeWorldEnergy(world), 1e-2).balanced).toBe(true);

    expect(() => stepReproductionSystem(world, -1)).toThrow(InvalidParameterError);

    // Edge cases: dead parent, juvenile parent, isolated sexual parent, and invalid mutated Blueprint abort cleanly
    const juvenile = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 4, y: 24 });
    world.ecs.requireComponent(juvenile, EnergyComponent).current = 75;
    world.ecs.requireComponent(juvenile, LifecycleComponent).ageSeconds = 1;
    world.ecs.addComponent(juvenile, ReproductionComponent, {
      speciesId: 'rabbit',
      blueprint: RABBIT_BLUEPRINT,
      spec: asexualSpec,
      mutation,
      cooldownRemainingSeconds: 0,
      generation: 0,
      offspringCount: 0,
    });

    const deadParent = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 6, y: 24 });
    world.ecs.requireComponent(deadParent, EnergyComponent).current = 75;
    world.ecs.requireComponent(deadParent, HealthComponent).dead = true;
    world.ecs.addComponent(deadParent, ReproductionComponent, {
      speciesId: 'rabbit',
      blueprint: RABBIT_BLUEPRINT,
      spec: asexualSpec,
      mutation,
      cooldownRemainingSeconds: 0,
      generation: 0,
      offspringCount: 0,
    });

    const lonely = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 26, y: 4 });
    world.ecs.requireComponent(lonely, EnergyComponent).current = 75;
    world.ecs.addComponent(lonely, ReproductionComponent, {
      speciesId: 'rabbit',
      blueprint: RABBIT_BLUEPRINT,
      spec: sexualSpec,
      mutation,
      cooldownRemainingSeconds: 0,
      generation: 0,
      offspringCount: 0,
    });

    // Mutated Blueprint violating min-collider-size is rejected cleanly across retries
    const invalidMutParent = spawnSpeciesEntity(world, RABBIT_BLUEPRINT, { x: 12, y: 24 });
    world.ecs.requireComponent(invalidMutParent, EnergyComponent).current = 75;
    world.ecs.addComponent(invalidMutParent, ReproductionComponent, {
      speciesId: 'rabbit',
      blueprint: RABBIT_BLUEPRINT,
      spec: asexualSpec,
      mutation: {
        rate: 1,
        mutable: [{ path: 'body.parts.1.shape.r', min: 0.001, max: 0.001, sigma: 0.01 }],
      },
      cooldownRemainingSeconds: 0,
      generation: 0,
      offspringCount: 0,
    });

    expect(stepReproductionSystem(world, 0.1)).toEqual([]);
    world.free();
  });
});
