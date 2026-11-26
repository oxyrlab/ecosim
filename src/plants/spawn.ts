import {
  assertFiniteVec2,
  clamp,
  InvalidParameterError,
  type EntityId,
  type Vec2,
} from '@core/index';
import { EnergyComponent, HealthComponent, LifecycleComponent } from '@life/index';
import { COLLISION_GROUP } from '@physics/types';
import { RenderableStubComponent, TagsComponent, type World } from '@world/index';
import {
  FruitComponent,
  PlantComponent,
  type PlantOrgans,
  type PlantSpeciesSpec,
  type PlantStage,
} from './components';

/**
 * Optional initial overrides when spawning a plant via {@link spawnPlant}.
 */
export interface SpawnPlantOptions {
  /** Starting lifecycle stage (default `'seed'`). */
  readonly stage?: PlantStage;
  /** Starting usable energy in `EU` (defaults to stage-appropriate value). */
  readonly initialEnergy?: number;
  /** Starting structural energy in `EU` (defaults to `0` for seeds, `spec.structuralEnergy` otherwise). */
  readonly structuralEnergy?: number;
  /** Starting age in seconds (default `0`). */
  readonly initialAgeSeconds?: number;
  /** When set, spawns the seed inside a carrier animal's gut without a physics body. */
  readonly carriedBy?: EntityId | null;
  /** Dispersal timer in seconds when `carriedBy` is set. */
  readonly dispersalRemainingSeconds?: number;
  /** Last known carrier position when `carriedBy` is set. */
  readonly lastCarrierPos?: Vec2 | null;
}

/**
 * Computes initial organ dimensions and radius for a given plant stage.
 */
export function computeInitialPlantMorphology(
  spec: PlantSpeciesSpec,
  stage: PlantStage,
): { readonly organs: PlantOrgans; readonly radius: number; readonly color: number } {
  switch (stage) {
    case 'seed':
      return {
        organs: { stemLength: 0, leafArea: 0, flowerCount: 0 },
        radius: spec.seedRadius,
        color: spec.seedColor,
      };
    case 'sprout':
      return {
        organs: {
          stemLength: spec.maxStemLength * 0.25,
          leafArea: spec.maxLeafArea * 0.25,
          flowerCount: 0,
        },
        radius: spec.seedRadius + (spec.adultRadius - spec.seedRadius) * 0.3,
        color: spec.plantColor,
      };
    case 'mature':
      return {
        organs: {
          stemLength: spec.maxStemLength * 0.85,
          leafArea: spec.maxLeafArea * 0.85,
          flowerCount: 0,
        },
        radius: spec.adultRadius * 0.9,
        color: spec.plantColor,
      };
    case 'flowering':
      return {
        organs: {
          stemLength: spec.maxStemLength,
          leafArea: spec.maxLeafArea,
          flowerCount: spec.maxFlowers,
        },
        radius: spec.adultRadius,
        color: spec.flowerColor,
      };
    case 'fruiting':
      return {
        organs: {
          stemLength: spec.maxStemLength,
          leafArea: spec.maxLeafArea,
          flowerCount: Math.max(1, Math.floor(spec.maxFlowers * 0.5)),
        },
        radius: spec.adultRadius,
        color: spec.plantColor,
      };
    case 'senescence':
      return {
        organs: {
          stemLength: spec.maxStemLength * 0.9,
          leafArea: spec.maxLeafArea * 0.4,
          flowerCount: 0,
        },
        radius: spec.adultRadius * 0.85,
        color: spec.seedColor,
      };
  }
}

/**
 * Synchronizes a plant's tags (`['plant', speciesId, stage]`) and stub render color/radius.
 */
export function syncPlantVisualsAndTags(world: World, entity: EntityId, stage: PlantStage): void {
  const plant = world.ecs.requireComponent(entity, PlantComponent);
  const tags = world.ecs.getComponent(entity, TagsComponent);
  if (tags !== undefined) {
    tags.values.clear();
    tags.values.add('plant');
    tags.values.add(plant.speciesId);
    tags.values.add(stage);
  }
  const renderable = world.ecs.getComponent(entity, RenderableStubComponent);
  if (renderable !== undefined) {
    world.ecs.setComponent(entity, RenderableStubComponent, {
      kind: renderable.kind,
      radius: plant.currentRadius,
      color:
        stage === 'seed' || stage === 'senescence'
          ? plant.spec.seedColor
          : stage === 'flowering'
            ? plant.spec.flowerColor
            : plant.spec.plantColor,
    });
  }
}

/**
 * Spawns a plant entity (`kingdom: 'plant'`, no brain or spine) into `world`.
 * Rooted plants receive a fixed `COLLISION_GROUP.PLANT` physics body; carried seeds
 * (`options.carriedBy !== null`) live in ECS only until excreted by `stepSeedDispersalSystem`.
 */
export function spawnPlant(
  world: World,
  spec: PlantSpeciesSpec,
  position: Vec2,
  options: SpawnPlantOptions = {},
): EntityId {
  assertFiniteVec2('position', position, 'spawnPlant');
  const stage = options.stage ?? 'seed';
  const carriedBy = options.carriedBy ?? null;
  const morph = computeInitialPlantMorphology(spec, stage);

  const clampedPos: Vec2 = {
    x: clamp(
      position.x,
      morph.radius,
      Math.max(morph.radius, world.config.widthMeters - morph.radius),
    ),
    y: clamp(
      position.y,
      morph.radius,
      Math.max(morph.radius, world.config.heightMeters - morph.radius),
    ),
  };

  const entity =
    carriedBy === null
      ? world.spawnSimpleBody({
          position: clampedPos,
          radius: morph.radius,
          bodyKind: 'fixed',
          kind: 2,
          color: morph.color,
          tags: ['plant', spec.speciesId, stage],
          collisionGroup: COLLISION_GROUP.PLANT,
        })
      : world.ecs.createEntity();

  const defaultEnergy =
    stage === 'seed'
      ? spec.seedEnergy
      : stage === 'sprout'
        ? Math.min(spec.maxEnergy, spec.seedEnergy * 1.5)
        : Math.min(spec.maxEnergy, spec.matureToFloweringEnergy);

  const initialEnergy = options.initialEnergy ?? defaultEnergy;
  const structuralEnergy =
    options.structuralEnergy ?? (stage === 'seed' ? 0 : spec.structuralEnergy);

  world.ecs.addComponent(entity, PlantComponent, {
    kingdom: 'plant',
    speciesId: spec.speciesId,
    spec,
    stage,
    stageTimeSeconds: 0,
    organs: { ...morph.organs },
    pollinated: stage === 'fruiting',
    fruitsInCurrentCycle: 0,
    totalFruitsProduced: 0,
    currentRadius: morph.radius,
    carriedBy,
    dispersalRemainingSeconds: options.dispersalRemainingSeconds ?? 0,
    lastCarrierPos: options.lastCarrierPos ?? (carriedBy !== null ? { ...clampedPos } : null),
  });

  world.ecs.addComponent(entity, EnergyComponent, {
    current: Math.min(spec.maxEnergy, Math.max(0, initialEnergy)),
    max: spec.maxEnergy,
    massKg: spec.massKg,
    basalRatePerKgPerSecond: stage === 'seed' ? 0 : spec.basalRatePerKgPerSecond,
    brainUpkeepPerSecond: 0,
    pendingActuatorCost: 0,
    starvationDamagePerSecond: 2,
    structuralEnergy,
  });

  world.ecs.addComponent(entity, LifecycleComponent, {
    ageSeconds: options.initialAgeSeconds ?? 0,
    maxAgeSeconds: spec.maxAgeSeconds,
    maturityAgeSeconds: spec.sproutToMatureAgeSeconds,
    juvenileScale: spec.seedRadius / spec.adultRadius,
    adultScale: 1,
    senescenceStartFraction: Math.min(0.95, spec.senescenceAgeSeconds / spec.maxAgeSeconds),
    minSenescenceEfficiency: 0.4,
    currentScale: morph.radius / spec.adultRadius,
    efficiency: 1,
  });

  world.ecs.addComponent(entity, HealthComponent, {
    current: 20,
    max: 20,
    pendingDamage: 0,
    recentPainPulse: 0,
    dead: false,
    deathCause: 'none',
    energyPerDamage: 1,
  });

  return entity;
}

/**
 * Spawns an independent fruit entity (`tags: ['fruit', speciesId]`, `COLLISION_GROUP.FRUIT`)
 * holding edible flesh energy in `EnergyComponent.current` and internal seed energy in
 * `EnergyComponent.structuralEnergy` so `computeWorldEnergy` accounts for both without leakage.
 */
export function spawnFruit(
  world: World,
  spec: PlantSpeciesSpec,
  position: Vec2,
  fleshEnergy = spec.fruitFleshEnergy,
  seedEnergy = spec.seedEnergy,
): EntityId {
  assertFiniteVec2('position', position, 'spawnFruit');
  if (!Number.isFinite(fleshEnergy) || fleshEnergy < 0) {
    throw new InvalidParameterError(
      'fleshEnergy',
      fleshEnergy,
      'a finite number >= 0',
      'spawnFruit',
    );
  }
  if (!Number.isFinite(seedEnergy) || seedEnergy <= 0) {
    throw new InvalidParameterError('seedEnergy', seedEnergy, 'a finite number > 0', 'spawnFruit');
  }

  const r = spec.fruitRadius;
  const clampedPos: Vec2 = {
    x: clamp(position.x, r, Math.max(r, world.config.widthMeters - r)),
    y: clamp(position.y, r, Math.max(r, world.config.heightMeters - r)),
  };

  const entity = world.spawnSimpleBody({
    position: clampedPos,
    radius: r,
    bodyKind: 'fixed',
    kind: 3,
    color: spec.fruitColor,
    tags: ['fruit', spec.speciesId],
    collisionGroup: COLLISION_GROUP.FRUIT,
  });

  world.ecs.addComponent(entity, FruitComponent, {
    speciesId: spec.speciesId,
    spec,
    ageSeconds: 0,
    maxAgeSeconds: spec.fruitLifespanSeconds,
    seedEnergy,
    scentRatePerSecond: spec.fruitScentRatePerSecond,
    germinationProbability: spec.fruitGerminationProbability,
    dispersalDelaySeconds: spec.dispersalDelaySeconds,
    eatenBy: null,
  });

  world.ecs.addComponent(entity, EnergyComponent, {
    current: fleshEnergy,
    max: Math.max(fleshEnergy, 1e-3),
    massKg: 0.1,
    basalRatePerKgPerSecond: 0,
    brainUpkeepPerSecond: 0,
    pendingActuatorCost: 0,
    starvationDamagePerSecond: 0,
    structuralEnergy: seedEnergy,
  });

  return entity;
}
