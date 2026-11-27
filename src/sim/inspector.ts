import { type EntityId, type Vec2 } from '@core/index';
import { ReproductionComponent } from '@genome/index';
import { CorpseComponent, EnergyComponent, HealthComponent, LifecycleComponent } from '@life/index';
import { FruitComponent, PlantComponent } from '@plants/index';
import { CreatureBrainComponent, speciesRegistry, validateAnimalBlueprint } from '@species/index';
import {
  PhysicsBodyComponent,
  RenderableStubComponent,
  TagsComponent,
  TransformComponent,
  type World,
} from '@world/index';

/**
 * Serialized state of a single brain module captured for live inspection.
 */
export interface InspectedBrainModule {
  readonly instanceId: string;
  readonly state: unknown;
}

/**
 * Constraint rule violation summary surfaced by the live entity Inspector.
 */
export interface InspectedRuleViolation {
  readonly ruleId: string;
  readonly severity: string;
  readonly message: string;
}

/**
 * JSON-serializable snapshot of a single entity's live internal state for the Observation UI.
 */
export interface EntityInspection {
  readonly entityId: number;
  readonly kingdom: 'animal' | 'plant' | 'fruit' | 'corpse' | 'body';
  readonly speciesId: string | null;
  readonly tags: readonly string[];
  readonly position: Vec2;
  readonly angle: number;
  readonly boundingRadius: number;
  readonly energy?: {
    readonly current: number;
    readonly max: number;
    readonly structuralEnergy: number;
    readonly massKg: number;
    readonly basalRatePerKgPerSecond: number;
    readonly brainUpkeepPerSecond: number;
  };
  readonly health?: {
    readonly current: number;
    readonly max: number;
    readonly dead: boolean;
    readonly deathCause: string;
    readonly recentPainPulse: number;
  };
  readonly lifecycle?: {
    readonly ageSeconds: number;
    readonly maxAgeSeconds: number;
    readonly maturityAgeSeconds: number;
    readonly currentScale: number;
    readonly efficiency: number;
  };
  readonly plant?: {
    readonly stage: string;
    readonly stageTimeSeconds: number;
    readonly stemLength: number;
    readonly leafArea: number;
    readonly flowerCount: number;
    readonly pollinated: boolean;
    readonly totalFruitsProduced: number;
  };
  readonly fruit?: {
    readonly ageSeconds: number;
    readonly maxAgeSeconds: number;
    readonly seedEnergy: number;
  };
  readonly corpse?: {
    readonly energy: number;
    readonly initialEnergy: number;
  };
  readonly reproduction?: {
    readonly generation: number;
    readonly offspringCount: number;
    readonly cooldownRemainingSeconds: number;
    readonly mode: string;
  };
  readonly neuromodulators?: {
    readonly reward: number;
    readonly aversive: number;
  };
  readonly signalBus?: Readonly<Record<string, number>>;
  readonly brainModules?: readonly InspectedBrainModule[];
  readonly ruleViolations?: readonly InspectedRuleViolation[];
}

/**
 * Finds the closest entity overlapping `position` within its bounding radius plus `paddingMeters`,
 * or `null` if no entity is near the pointer.
 */
export function pickEntityAtWorldPos(
  world: World,
  position: Vec2,
  paddingMeters = 0.4,
): EntityId | null {
  const searchRadius = Math.max(0.5, paddingMeters + 2);
  const candidates = world.spatialHash.queryRadius(position.x, position.y, searchRadius);
  let bestId: EntityId | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const entity of candidates) {
    if (!world.ecs.isAlive(entity)) continue;
    const transform = world.ecs.getComponent(entity, TransformComponent);
    if (transform === undefined) continue;
    const body = world.ecs.getComponent(entity, PhysicsBodyComponent);
    const stub = world.ecs.getComponent(entity, RenderableStubComponent);
    const radius = Math.max(body?.boundingRadius ?? 0, stub?.radius ?? 0.25);
    const dist = Math.hypot(transform.x - position.x, transform.y - position.y);
    if (dist <= radius + paddingMeters && dist < bestDist) {
      bestDist = dist;
      bestId = entity;
    }
  }
  return bestId;
}

/**
 * Builds a JSON-serializable {@link EntityInspection} for `entityId` (or `null` if dead/missing).
 * Captures live `SignalBus` channel readings, brain module `serialize()` states, vitals, tags,
 * and Constraint Rule diagnostics.
 */
export function inspectEntity(world: World, entityId: EntityId): EntityInspection | null {
  if (!world.ecs.isAlive(entityId)) return null;
  const transform = world.ecs.getComponent(entityId, TransformComponent);
  if (transform === undefined) return null;

  const body = world.ecs.getComponent(entityId, PhysicsBodyComponent);
  const stub = world.ecs.getComponent(entityId, RenderableStubComponent);
  const tagsComp = world.ecs.getComponent(entityId, TagsComponent);
  const brain = world.ecs.getComponent(entityId, CreatureBrainComponent);
  const plant = world.ecs.getComponent(entityId, PlantComponent);
  const fruit = world.ecs.getComponent(entityId, FruitComponent);
  const corpse = world.ecs.getComponent(entityId, CorpseComponent);
  const energy = world.ecs.getComponent(entityId, EnergyComponent);
  const health = world.ecs.getComponent(entityId, HealthComponent);
  const lifecycle = world.ecs.getComponent(entityId, LifecycleComponent);
  const repro = world.ecs.getComponent(entityId, ReproductionComponent);

  let kingdom: EntityInspection['kingdom'] = 'body';
  let speciesId: string | null = null;
  if (brain !== undefined) {
    kingdom = 'animal';
    speciesId = brain.speciesId;
  } else if (plant !== undefined) {
    kingdom = 'plant';
    speciesId = plant.speciesId;
  } else if (fruit !== undefined) {
    kingdom = 'fruit';
    speciesId = fruit.speciesId;
  } else if (corpse !== undefined) {
    kingdom = 'corpse';
  }

  let brainModules: InspectedBrainModule[] | undefined;
  let ruleViolations: InspectedRuleViolation[] | undefined;

  if (brain !== undefined) {
    brainModules = brain.brainModules.map((mod) => ({
      instanceId: mod.instanceId,
      state: mod.instance.serialize !== undefined ? mod.instance.serialize() : null,
    }));

    const blueprint = repro?.blueprint ?? speciesRegistry.tryGet(brain.speciesId);
    if (blueprint !== undefined && blueprint.kingdom === 'animal') {
      try {
        const validated = validateAnimalBlueprint(
          blueprint,
          lifecycle?.currentScale ?? blueprint.lifecycle.adultScale,
        );
        ruleViolations = validated.ruleReport.violations.map((v) => ({
          ruleId: v.ruleId,
          severity: v.severity,
          message: v.message,
        }));
      } catch (err) {
        ruleViolations = [
          {
            ruleId: 'blueprint-validation',
            severity: 'error',
            message: err instanceof Error ? err.message : String(err),
          },
        ];
      }
    }
  }

  return {
    entityId,
    kingdom,
    speciesId,
    tags: tagsComp !== undefined ? Array.from(tagsComp.values).sort() : [],
    position: { x: transform.x, y: transform.y },
    angle: transform.angle,
    boundingRadius: body?.boundingRadius ?? stub?.radius ?? 0.2,
    ...(energy !== undefined
      ? {
          energy: {
            current: energy.current,
            max: energy.max,
            structuralEnergy: energy.structuralEnergy,
            massKg: energy.massKg,
            basalRatePerKgPerSecond: energy.basalRatePerKgPerSecond,
            brainUpkeepPerSecond: energy.brainUpkeepPerSecond,
          },
        }
      : {}),
    ...(health !== undefined
      ? {
          health: {
            current: health.current,
            max: health.max,
            dead: health.dead,
            deathCause: health.deathCause,
            recentPainPulse: health.recentPainPulse,
          },
        }
      : {}),
    ...(lifecycle !== undefined
      ? {
          lifecycle: {
            ageSeconds: lifecycle.ageSeconds,
            maxAgeSeconds: lifecycle.maxAgeSeconds,
            maturityAgeSeconds: lifecycle.maturityAgeSeconds,
            currentScale: lifecycle.currentScale,
            efficiency: lifecycle.efficiency,
          },
        }
      : {}),
    ...(plant !== undefined
      ? {
          plant: {
            stage: plant.stage,
            stageTimeSeconds: plant.stageTimeSeconds,
            stemLength: plant.organs.stemLength,
            leafArea: plant.organs.leafArea,
            flowerCount: plant.organs.flowerCount,
            pollinated: plant.pollinated,
            totalFruitsProduced: plant.totalFruitsProduced,
          },
        }
      : {}),
    ...(fruit !== undefined
      ? {
          fruit: {
            ageSeconds: fruit.ageSeconds,
            maxAgeSeconds: fruit.maxAgeSeconds,
            seedEnergy: fruit.seedEnergy,
          },
        }
      : {}),
    ...(corpse !== undefined
      ? {
          corpse: {
            energy: corpse.energy,
            initialEnergy: corpse.initialEnergy,
          },
        }
      : {}),
    ...(repro !== undefined
      ? {
          reproduction: {
            generation: repro.generation,
            offspringCount: repro.offspringCount,
            cooldownRemainingSeconds: repro.cooldownRemainingSeconds,
            mode: repro.spec.mode,
          },
        }
      : {}),
    ...(brain?.neuromodulators !== undefined
      ? {
          neuromodulators: {
            reward: brain.neuromodulators.reward,
            aversive: brain.neuromodulators.aversive,
          },
        }
      : {}),
    ...(brain !== undefined ? { signalBus: brain.bus.snapshot() } : {}),
    ...(brainModules !== undefined ? { brainModules } : {}),
    ...(ruleViolations !== undefined ? { ruleViolations } : {}),
  };
}
