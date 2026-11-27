import { z } from 'zod';
import {
  assertFiniteNumber,
  clamp,
  defineComponent,
  InvalidParameterError,
  type EntityId,
} from '@core/index';
import {
  EnergyComponent,
  HealthComponent,
  LifecycleComponent,
  type EnergyLedger,
} from '@life/index';
import type { AnimalSpeciesBlueprint } from '@species/blueprint';
import { spawnSpeciesEntity, validateAnimalBlueprint } from '@species/entity-factory';
import { TransformComponent, type World } from '@world/index';
import { crossoverBlueprints, mutateBlueprint, type MutationSpec } from './mutation';

/**
 * Reproduction mode supported by {@link stepReproductionSystem}.
 */
export type ReproductionMode = 'asexual' | 'sexual';

/**
 * Species reproduction parameters governing energy thresholds, costs, and mate search radius.
 */
export interface ReproductionSpec {
  /** Asexual (single parent) or sexual (two conspecific mature parents). */
  readonly mode: ReproductionMode;
  /** Minimum stored `energy.current` required for each parent to reproduce (`EU`). */
  readonly minEnergyToReproduce: number;
  /** Usable energy (`energy.current`) gifted to the offspring (`EU`). */
  readonly offspringEnergy: number;
  /** Metabolic heat overhead dissipated during reproduction (`EU`). */
  readonly overheadCost: number;
  /** Cooldown between reproductive events per parent in seconds. */
  readonly cooldownSeconds: number;
  /** Maximum distance in meters to find a conspecific mate in `'sexual'` mode. */
  readonly mateRadiusMeters: number;
}

/**
 * Zod schema validating a {@link ReproductionSpec}.
 */
export const reproductionSpecSchema = z.object({
  mode: z.enum(['asexual', 'sexual']).default('asexual'),
  minEnergyToReproduce: z.number().finite().positive().default(55),
  offspringEnergy: z.number().finite().positive().default(25),
  overheadCost: z.number().finite().nonnegative().default(5),
  cooldownSeconds: z.number().finite().nonnegative().default(15),
  mateRadiusMeters: z.number().finite().positive().default(3),
});

/**
 * ECS component state enabling an animal to reproduce with mutated Blueprints.
 */
export interface ReproductionData {
  readonly speciesId: string;
  readonly blueprint: AnimalSpeciesBlueprint;
  readonly spec: ReproductionSpec;
  readonly mutation: MutationSpec;
  cooldownRemainingSeconds: number;
  readonly generation: number;
  offspringCount: number;
}

/**
 * Event record emitted whenever an offspring is born during {@link stepReproductionSystem}.
 */
export interface ReproductionRecord {
  readonly mode: ReproductionMode;
  readonly parentIds: readonly EntityId[];
  readonly offspringId: EntityId;
  readonly generation: number;
  readonly offspringBlueprint: AnimalSpeciesBlueprint;
}

/** ECS component storing an animal's hereditary Blueprint, mutation spec, and reproduction state. */
export const ReproductionComponent = defineComponent<ReproductionData>(
  'reproduction',
  'Reproduction',
);

const MAX_MUTATION_RETRIES = 4;

function isReadyToReproduce(world: World, entity: EntityId, requiredEnergy: number): boolean {
  const health = world.ecs.getComponent(entity, HealthComponent);
  if (health !== undefined && health.dead) return false;
  const repro = world.ecs.getComponent(entity, ReproductionComponent);
  if (repro === undefined || repro.cooldownRemainingSeconds > 0) return false;
  const energy = world.ecs.getComponent(entity, EnergyComponent);
  if (energy === undefined || energy.current < requiredEnergy) return false;
  const lifecycle = world.ecs.getComponent(entity, LifecycleComponent);
  if (lifecycle !== undefined && lifecycle.ageSeconds < lifecycle.maturityAgeSeconds) return false;
  return true;
}

function buildValidOffspringBlueprint(
  parentA: AnimalSpeciesBlueprint,
  parentB: AnimalSpeciesBlueprint | null,
  mutation: MutationSpec,
  world: World,
): AnimalSpeciesBlueprint | null {
  for (let attempt = 0; attempt < MAX_MUTATION_RETRIES; attempt += 1) {
    const candidate =
      parentB !== null
        ? crossoverBlueprints(parentA, parentB, mutation, world.rng)
        : mutateBlueprint(parentA, mutation, world.rng);
    try {
      validateAnimalBlueprint(candidate);
      return candidate;
    } catch {
      // Mutated gene violated an error-level Constraint Rule (e.g. learning-rate-bounds); retry.
    }
  }
  return null;
}

/**
 * Advances cooldowns and resolves asexual and sexual animal reproduction in `world` (Section 5.8).
 *
 * - Offspring inherit a mutated (and in sexual mode, crossed-over) {@link AnimalSpeciesBlueprint}
 *   re-validated against all Constraint Rules.
 * - Offspring always start with completely empty lifetime learning memory (ADR 0008).
 * - Energy is strictly conserved against `EnergyLedger.recordReproduction`: parents pay
 *   `offspringEnergy + offspringStructuralEnergy + overheadCost`.
 */
export function stepReproductionSystem(
  world: World,
  dt: number,
  ledger?: EnergyLedger,
): ReproductionRecord[] {
  assertFiniteNumber('dt', dt, 'stepReproductionSystem');
  if (dt < 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number >= 0', 'stepReproductionSystem');
  }

  const entities = world.ecs.query(ReproductionComponent, EnergyComponent, TransformComponent);
  for (const entity of entities) {
    const repro = world.ecs.requireComponent(entity, ReproductionComponent);
    if (repro.cooldownRemainingSeconds > 0) {
      repro.cooldownRemainingSeconds = Math.max(0, repro.cooldownRemainingSeconds - dt);
    }
  }

  const records: ReproductionRecord[] = [];
  const matedThisTick = new Set<EntityId>();

  for (const entity of entities) {
    if (matedThisTick.has(entity) || !world.ecs.isAlive(entity)) continue;
    const repro = world.ecs.requireComponent(entity, ReproductionComponent);
    const spec = repro.spec;
    const offspringTotalEu = spec.offspringEnergy + repro.blueprint.metabolism.structuralEnergy;
    const totalNeeded = offspringTotalEu + spec.overheadCost;

    if (spec.mode === 'asexual') {
      const parentMin = Math.max(spec.minEnergyToReproduce, totalNeeded + 1);
      if (!isReadyToReproduce(world, entity, parentMin)) continue;

      const childBp = buildValidOffspringBlueprint(repro.blueprint, null, repro.mutation, world);
      if (childBp === null) continue;

      const parentEnergy = world.ecs.requireComponent(entity, EnergyComponent);
      const parentPos = world.ecs.requireComponent(entity, TransformComponent);

      parentEnergy.current -= totalNeeded;
      ledger?.recordReproduction(offspringTotalEu, spec.overheadCost);

      const angle = world.rng.next() * Math.PI * 2;
      const offset = 0.65;
      const childPos = {
        x: clamp(
          parentPos.x + Math.cos(angle) * offset,
          1,
          Math.max(1, world.config.widthMeters - 1),
        ),
        y: clamp(
          parentPos.y + Math.sin(angle) * offset,
          1,
          Math.max(1, world.config.heightMeters - 1),
        ),
      };

      const childBpWithEnergy: AnimalSpeciesBlueprint = {
        ...childBp,
        metabolism: {
          ...childBp.metabolism,
          initialEnergy: spec.offspringEnergy,
        },
      };
      const offspringId = spawnSpeciesEntity(world, childBpWithEnergy, childPos, {
        angle: world.rng.next() * Math.PI * 2,
      });
      world.ecs.addComponent(offspringId, ReproductionComponent, {
        speciesId: repro.speciesId,
        blueprint: childBpWithEnergy,
        spec: repro.spec,
        mutation: repro.mutation,
        cooldownRemainingSeconds: spec.cooldownSeconds,
        generation: repro.generation + 1,
        offspringCount: 0,
      });

      repro.cooldownRemainingSeconds = spec.cooldownSeconds;
      repro.offspringCount += 1;
      matedThisTick.add(entity);
      records.push({
        mode: 'asexual',
        parentIds: [entity],
        offspringId,
        generation: repro.generation + 1,
        offspringBlueprint: childBpWithEnergy,
      });
    } else {
      const halfCost = totalNeeded * 0.5;
      const parentMin = Math.max(spec.minEnergyToReproduce, halfCost + 1);
      if (!isReadyToReproduce(world, entity, parentMin)) continue;

      const parentPos = world.ecs.requireComponent(entity, TransformComponent);
      const neighbors = world.spatialHash.queryRadius(
        parentPos.x,
        parentPos.y,
        spec.mateRadiusMeters,
      );

      let partnerId: EntityId | null = null;
      for (const candidate of neighbors) {
        if (candidate === entity || matedThisTick.has(candidate) || !world.ecs.isAlive(candidate)) {
          continue;
        }
        const partnerRepro = world.ecs.getComponent(candidate, ReproductionComponent);
        if (
          partnerRepro === undefined ||
          partnerRepro.speciesId !== repro.speciesId ||
          partnerRepro.spec.mode !== 'sexual'
        ) {
          continue;
        }
        if (!isReadyToReproduce(world, candidate, parentMin)) continue;
        const pPos = world.ecs.getComponent(candidate, TransformComponent);
        if (pPos === undefined) continue;
        if (Math.hypot(pPos.x - parentPos.x, pPos.y - parentPos.y) <= spec.mateRadiusMeters) {
          partnerId = candidate;
          break;
        }
      }

      if (partnerId === null) continue;
      const partnerRepro = world.ecs.requireComponent(partnerId, ReproductionComponent);
      const childBp = buildValidOffspringBlueprint(
        repro.blueprint,
        partnerRepro.blueprint,
        repro.mutation,
        world,
      );
      if (childBp === null) continue;

      const energyA = world.ecs.requireComponent(entity, EnergyComponent);
      const energyB = world.ecs.requireComponent(partnerId, EnergyComponent);
      const posB = world.ecs.requireComponent(partnerId, TransformComponent);

      energyA.current -= halfCost;
      energyB.current -= halfCost;
      ledger?.recordReproduction(offspringTotalEu, spec.overheadCost);

      const midX = clamp(
        (parentPos.x + posB.x) * 0.5,
        1,
        Math.max(1, world.config.widthMeters - 1),
      );
      const midY = clamp(
        (parentPos.y + posB.y) * 0.5,
        1,
        Math.max(1, world.config.heightMeters - 1),
      );

      const childBpWithEnergy: AnimalSpeciesBlueprint = {
        ...childBp,
        metabolism: {
          ...childBp.metabolism,
          initialEnergy: spec.offspringEnergy,
        },
      };
      const generation = Math.max(repro.generation, partnerRepro.generation) + 1;
      const offspringId = spawnSpeciesEntity(
        world,
        childBpWithEnergy,
        { x: midX, y: midY },
        {
          angle: world.rng.next() * Math.PI * 2,
        },
      );
      world.ecs.addComponent(offspringId, ReproductionComponent, {
        speciesId: repro.speciesId,
        blueprint: childBpWithEnergy,
        spec: repro.spec,
        mutation: repro.mutation,
        cooldownRemainingSeconds: spec.cooldownSeconds,
        generation,
        offspringCount: 0,
      });

      repro.cooldownRemainingSeconds = spec.cooldownSeconds;
      repro.offspringCount += 1;
      partnerRepro.cooldownRemainingSeconds = spec.cooldownSeconds;
      partnerRepro.offspringCount += 1;
      matedThisTick.add(entity);
      matedThisTick.add(partnerId);
      records.push({
        mode: 'sexual',
        parentIds: [entity, partnerId],
        offspringId,
        generation,
        offspringBlueprint: childBpWithEnergy,
      });
    }
  }

  return records;
}
