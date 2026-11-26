import { buildPhysicsBodyFromLayout, resolveLayout } from '@appearance/layout';
import type { ResolvedBodyLayout } from '@appearance/types';
import { actuatorRegistry, resolvePortMap, sensorRegistry } from '@body/index';
import { brainModuleRegistry, type BrainModuleInstance } from '@brain/index';
import {
  resolveWiring,
  type ResolvedComponentHandles,
  type ResolvedWiring,
  type WiringEndpoint,
} from '@bus/wiring';
import {
  assertFiniteVec2,
  BlueprintValidationError,
  createSeededRng,
  type EntityId,
  type Vec2,
} from '@core/index';
import { DietComponent, EnergyComponent, HealthComponent, LifecycleComponent } from '@life/index';
import { COLLISION_GROUP, type BodyHandle } from '@physics/types';
import { spawnPlant, type SpawnPlantOptions } from '@plants/spawn';
import { evaluateRules, resolveRules, type RuleEvaluationReport } from '@rules/index';
import '@rules/defs';
import { spineRegistry } from '@spine/index';
import {
  PhysicsBodyComponent,
  RenderableStubComponent,
  TagsComponent,
  TransformComponent,
  type World,
} from '@world/index';
import {
  speciesBlueprintSchema,
  type AnimalSpeciesBlueprint,
  type SpeciesBlueprint,
} from './blueprint';
import {
  CreatureBrainComponent,
  type MountedActuatorRuntime,
  type MountedSensorRuntime,
} from './creature-runtime';

/**
 * Result of validating an {@link AnimalSpeciesBlueprint} prior to spawning.
 */
export interface ValidatedAnimalBlueprint {
  readonly layout: ResolvedBodyLayout;
  readonly wiring: ResolvedWiring;
  readonly ruleReport: RuleEvaluationReport;
  readonly totalMassKg: number;
  readonly boundingRadius: number;
  readonly parsedSensors: ReadonlyArray<{
    readonly instanceId: string;
    readonly sensorId: string;
    readonly params: unknown;
    readonly localPosition: Vec2;
    readonly localAngle: number;
  }>;
  readonly parsedActuators: ReadonlyArray<{
    readonly instanceId: string;
    readonly actuatorId: string;
    readonly params: unknown;
    readonly groupId: string;
    readonly localPosition: Vec2;
    readonly localAngle: number;
  }>;
  readonly parsedBrainModules: ReadonlyArray<{
    readonly instanceId: string;
    readonly moduleId: string;
    readonly params: unknown;
  }>;
  readonly parsedSpine: {
    readonly instanceId: string;
    readonly spineId: string;
    readonly params: unknown;
  };
}

/**
 * Optional spawn overrides passed to {@link spawnSpeciesEntity}.
 */
export interface SpawnSpeciesOptions {
  /** Initial facing angle in radians for animals (default `0`). */
  readonly angle?: number;
  /** Initial growth scale for animals (default `blueprint.lifecycle.adultScale`). */
  readonly scale?: number;
  /** Optional plant spawn options when spawning a `kingdom: 'plant'` blueprint. */
  readonly plantOptions?: SpawnPlantOptions;
}

/**
 * Validates an {@link AnimalSpeciesBlueprint} end-to-end: Zod schema, procedural body layout,
 * registered sensors/actuators/brain modules/spine + their param schemas, SignalBus static
 * wiring, and all registered Constraint Rules (`error` severity rejects the Blueprint).
 */
export function validateAnimalBlueprint(
  blueprint: AnimalSpeciesBlueprint,
  scale = blueprint.lifecycle.adultScale,
): ValidatedAnimalBlueprint {
  speciesBlueprintSchema.parse(blueprint);

  const ruleConfig = resolveRules(
    blueprint.ruleOverrides !== undefined ? { speciesOverrides: blueprint.ruleOverrides } : {},
  );
  const concaveRule = ruleConfig.get('collider-concave-strategy');
  const concaveStrategy =
    (concaveRule?.params as { readonly strategy?: 'reject' | 'hull' | 'decompose' } | undefined)
      ?.strategy ?? 'decompose';

  const layout = resolveLayout(blueprint.body.parts, scale, concaveStrategy);
  const endpoints: WiringEndpoint[] = [];

  const parsedSensors: Array<{
    readonly instanceId: string;
    readonly sensorId: string;
    readonly params: unknown;
    readonly localPosition: Vec2;
    readonly localAngle: number;
  }> = [];
  const parsedActuators: Array<{
    readonly instanceId: string;
    readonly actuatorId: string;
    readonly params: unknown;
    readonly groupId: string;
    readonly localPosition: Vec2;
    readonly localAngle: number;
  }> = [];

  let totalMassKg = 0;
  let maxRadius = 0.1;

  for (const resolved of layout.parts) {
    totalMassKg += resolved.mass;
    const partReach =
      Math.hypot(resolved.position.x, resolved.position.y) +
      Math.max(resolved.bounds.w, resolved.bounds.h) * 0.5;
    if (partReach > maxRadius) maxRadius = partReach;

    for (const sRef of resolved.part.sensors) {
      const def = sensorRegistry.tryGet(sRef.sensor);
      if (def === undefined) {
        throw new BlueprintValidationError(
          `Unknown sensor "${sRef.sensor}" on part "${resolved.id}".`,
          `body.parts.${resolved.id}.sensors`,
        );
      }
      const params = def.params.parse(sRef.params ?? {});
      const outputs = resolvePortMap(def.outputs, params);
      endpoints.push({ instanceId: sRef.instanceId, inputs: {}, outputs });
      parsedSensors.push({
        instanceId: sRef.instanceId,
        sensorId: sRef.sensor,
        params,
        localPosition: resolved.position,
        localAngle: resolved.angle,
      });
    }

    if (resolved.part.actuator !== undefined) {
      const aRef = resolved.part.actuator;
      const def = actuatorRegistry.tryGet(aRef.actuator);
      if (def === undefined) {
        throw new BlueprintValidationError(
          `Unknown actuator "${aRef.actuator}" on part "${resolved.id}".`,
          `body.parts.${resolved.id}.actuator`,
        );
      }
      const params = def.params.parse(aRef.params ?? {});
      const inputs = resolvePortMap(def.inputs, params);
      endpoints.push({ instanceId: aRef.instanceId, inputs, outputs: {} });
      const ancestor =
        resolved.physicalAncestorId !== null
          ? layout.byId.get(resolved.physicalAncestorId)
          : undefined;
      const groupId = resolved.rigidBodyGroupId ?? ancestor?.rigidBodyGroupId ?? '';
      parsedActuators.push({
        instanceId: aRef.instanceId,
        actuatorId: aRef.actuator,
        params,
        groupId,
        localPosition: resolved.position,
        localAngle: resolved.angle,
      });
    }
  }

  const parsedBrainModules: Array<{
    readonly instanceId: string;
    readonly moduleId: string;
    readonly params: unknown;
  }> = [];

  for (const mRef of blueprint.brain.modules) {
    const def = brainModuleRegistry.tryGet(mRef.module);
    if (def === undefined) {
      throw new BlueprintValidationError(
        `Unknown brain module "${mRef.module}" (instance "${mRef.instanceId}").`,
        `brain.modules.${mRef.instanceId}`,
      );
    }
    const params = def.params.parse(mRef.params ?? {});
    const inputs = resolvePortMap(def.inputs, params);
    const outputs = resolvePortMap(def.outputs, params);
    endpoints.push({
      instanceId: mRef.instanceId,
      inputs,
      outputs,
      ...(def.publish !== undefined ? { publish: def.publish } : {}),
      ...(def.subscribe !== undefined ? { subscribe: def.subscribe } : {}),
    });
    parsedBrainModules.push({ instanceId: mRef.instanceId, moduleId: mRef.module, params });
  }

  const spineDef = spineRegistry.tryGet(blueprint.spine.spine);
  if (spineDef === undefined) {
    throw new BlueprintValidationError(`Unknown spine "${blueprint.spine.spine}".`, 'spine');
  }
  const spineParams = spineDef.params.parse(blueprint.spine.params ?? {});
  const spineInputs = resolvePortMap(spineDef.inputs, spineParams);
  const spineOutputs = resolvePortMap(spineDef.outputs, spineParams);
  endpoints.push({
    instanceId: blueprint.spine.instanceId,
    inputs: spineInputs,
    outputs: spineOutputs,
  });

  const wiring = resolveWiring(endpoints, blueprint.wiring);

  const ruleReport = evaluateRules(
    'blueprint',
    {
      body: blueprint.body,
      scale,
      brain: { modules: blueprint.brain.modules },
      nervousGraph: { endpoints, wires: blueprint.wiring },
    },
    ruleConfig,
  );
  if (!ruleReport.ok) {
    const summary = ruleReport.errors.map((v) => `${v.ruleId}: ${v.message}`).join('; ');
    throw new BlueprintValidationError(
      `Blueprint "${blueprint.id}" violated error-level Constraint Rules: ${summary}`,
      blueprint.id,
    );
  }

  return {
    layout,
    wiring,
    ruleReport,
    totalMassKg: Math.max(0.1, totalMassKg),
    boundingRadius: maxRadius,
    parsedSensors,
    parsedActuators,
    parsedBrainModules,
    parsedSpine: {
      instanceId: blueprint.spine.instanceId,
      spineId: blueprint.spine.spine,
      params: spineParams,
    },
  };
}

/**
 * Spawns any validated {@link SpeciesBlueprint} (animal or plant) into `world` at `position`,
 * constructing ECS components, Rapier physics bodies/joints, `SpatialHash` registration, and
 * (for animals) an isolated `SignalBus`, sensors, brain modules, spine, and actuators.
 */
export function spawnSpeciesEntity(
  world: World,
  blueprint: SpeciesBlueprint,
  position: Vec2,
  options: SpawnSpeciesOptions = {},
): EntityId {
  assertFiniteVec2('position', position, 'spawnSpeciesEntity');

  if (blueprint.kingdom === 'plant') {
    return spawnPlant(world, blueprint.plantSpec, position, options.plantOptions);
  }

  const scale = options.scale ?? blueprint.lifecycle.adultScale;
  const angle = options.angle ?? 0;
  const validated = validateAnimalBlueprint(blueprint, scale);

  const entity = world.ecs.createEntity();
  const built = buildPhysicsBodyFromLayout(
    validated.layout,
    world.physics,
    position,
    angle,
    COLLISION_GROUP.CREATURE,
    COLLISION_GROUP.ALL,
  );

  for (const bh of built.bodies) {
    world.registerEntityBody(bh, entity);
  }
  const extraBodyHandles = built.bodies.filter((b) => b !== built.rootBody);

  world.ecs.addComponent(entity, TransformComponent, {
    x: position.x,
    y: position.y,
    angle,
  });
  world.ecs.addComponent(entity, PhysicsBodyComponent, {
    bodyHandle: built.rootBody,
    ...(extraBodyHandles.length > 0 ? { extraBodyHandles } : {}),
    colliderHandles: built.colliders,
    jointHandles: built.joints,
    boundingRadius: validated.boundingRadius,
  });
  world.ecs.addComponent(entity, RenderableStubComponent, {
    kind: 1,
    radius: validated.boundingRadius,
    color: blueprint.stubColor,
  });
  world.ecs.addComponent(entity, TagsComponent, {
    values: new Set(blueprint.tags),
  });
  world.spatialHash.insert(entity, position.x, position.y, validated.boundingRadius);

  const entityRng = createSeededRng(world.rng.nextInt(1, 0x7ffffffe));

  // Instantiate sensors
  const sensors: MountedSensorRuntime[] = validated.parsedSensors.map((s) => {
    const def = sensorRegistry.get(s.sensorId);
    const handles = validated.wiring.handles.get(s.instanceId) as ResolvedComponentHandles;
    return {
      instanceId: s.instanceId,
      localPosition: s.localPosition,
      localAngle: s.localAngle,
      instance: def.create(s.params, { outputs: handles.outputs }),
    };
  });

  // Instantiate brain modules
  const brainModules: Array<{
    readonly instanceId: string;
    readonly instance: BrainModuleInstance;
  }> = validated.parsedBrainModules.map((m) => {
    const def = brainModuleRegistry.get(m.moduleId);
    const handles = validated.wiring.handles.get(m.instanceId) as ResolvedComponentHandles;
    return {
      instanceId: m.instanceId,
      instance: def.create(
        m.params,
        {
          inputs: handles.inputs,
          outputs: handles.outputs,
          publish: handles.publish,
          subscribe: handles.subscribe,
        },
        entityRng,
      ),
    };
  });

  // Instantiate spine
  const spineDef = spineRegistry.get(validated.parsedSpine.spineId);
  const spineHandles = validated.wiring.handles.get(
    validated.parsedSpine.instanceId,
  ) as ResolvedComponentHandles;
  const spine = spineDef.create(validated.parsedSpine.params, {
    inputs: spineHandles.inputs,
    outputs: spineHandles.outputs,
  });

  // Instantiate actuators
  const actuators: MountedActuatorRuntime[] = validated.parsedActuators.map((a) => {
    const def = actuatorRegistry.get(a.actuatorId);
    const handles = validated.wiring.handles.get(a.instanceId) as ResolvedComponentHandles;
    const targetBody = (built.bodiesByGroup.get(a.groupId) ?? built.rootBody) as BodyHandle;
    return {
      instanceId: a.instanceId,
      targetBody,
      localPosition: a.localPosition,
      localAngle: a.localAngle,
      instance: def.create(a.params, { inputs: handles.inputs }),
    };
  });

  world.ecs.addComponent(entity, CreatureBrainComponent, {
    speciesId: blueprint.id,
    bus: validated.wiring.bus,
    layout: validated.layout,
    rng: entityRng,
    sensors,
    brainModules,
    spine,
    actuators,
    ...(blueprint.scentEmission !== undefined ? { scentEmission: blueprint.scentEmission } : {}),
  });

  world.ecs.addComponent(entity, EnergyComponent, {
    current: blueprint.metabolism.initialEnergy,
    max: blueprint.metabolism.maxEnergy,
    massKg: validated.totalMassKg,
    basalRatePerKgPerSecond: blueprint.metabolism.basalRatePerKgPerSecond,
    brainUpkeepPerSecond:
      blueprint.brain.modules.length * blueprint.metabolism.brainUpkeepPerModulePerSecond,
    pendingActuatorCost: 0,
    starvationDamagePerSecond: blueprint.metabolism.starvationDamagePerSecond,
    structuralEnergy: blueprint.metabolism.structuralEnergy,
  });

  world.ecs.addComponent(entity, DietComponent, {
    assimilationEfficiency: blueprint.diet.assimilationEfficiency,
    edibleTags: blueprint.diet.edibleTags,
  });

  world.ecs.addComponent(entity, LifecycleComponent, {
    ageSeconds: blueprint.lifecycle.maturityAgeSeconds,
    maxAgeSeconds: blueprint.lifecycle.maxAgeSeconds,
    maturityAgeSeconds: blueprint.lifecycle.maturityAgeSeconds,
    juvenileScale: blueprint.lifecycle.juvenileScale,
    adultScale: blueprint.lifecycle.adultScale,
    senescenceStartFraction: blueprint.lifecycle.senescenceStartFraction,
    minSenescenceEfficiency: blueprint.lifecycle.minSenescenceEfficiency,
    currentScale: scale,
    efficiency: 1,
  });

  world.ecs.addComponent(entity, HealthComponent, {
    current: blueprint.lifecycle.maxHealth,
    max: blueprint.lifecycle.maxHealth,
    pendingDamage: 0,
    recentPainPulse: 0,
    dead: false,
    deathCause: 'none',
    energyPerDamage: blueprint.lifecycle.energyPerDamage,
  });

  return entity;
}
