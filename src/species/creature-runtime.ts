import type { AppearanceFeatures } from '@appearance/features';
import type { ResolvedBodyLayout } from '@appearance/types';
import type { ActuatorActionEvent, ActuatorContext, ActuatorInstance } from '@body/actuators';
import {
  areOrgansComplementary,
  computeOrganWorldPosition,
  ReproductiveOrganComponent,
} from '@body/organs';
import type {
  NeighborObservation,
  NeighborReproductiveOrgan,
  SensorContext,
  SensorInstance,
} from '@body/sensors';
import {
  decayNeuromodulators,
  type BrainModuleInstance,
  type NeuromodulatorState,
} from '@brain/index';
import type { PortHandle } from '@bus/ports';
import type { SignalBus } from '@bus/signal-bus';
import {
  assertFiniteNumber,
  clamp,
  defineComponent,
  InvalidParameterError,
  type EntityId,
  type SeededRng,
  type Vec2,
} from '@core/index';
import { EnergyComponent, HealthComponent, LifecycleComponent, type EnergyData } from '@life/index';
import type { BodyHandle } from '@physics/types';
import type { SpineInstance } from '@spine/index';
import { PhysicsBodyComponent, TagsComponent, TransformComponent, type World } from '@world/index';
import type { AnimalScentSpec } from './blueprint';

/**
 * Bound runtime sensor mounted at a body-part offset inside a creature.
 */
export interface MountedSensorRuntime {
  readonly instanceId: string;
  readonly localPosition: Vec2;
  readonly localAngle: number;
  readonly sampleRateHz?: number;
  sampleCooldownSeconds?: number;
  sampledOnce?: boolean;
  readonly instance: SensorInstance;
}

/**
 * Bound runtime actuator mounted at a body-part offset and routed to its nearest physical ancestor.
 */
export interface MountedActuatorRuntime {
  readonly instanceId: string;
  readonly targetBody: BodyHandle;
  readonly localPosition: Vec2;
  readonly localAngle: number;
  readonly instance: ActuatorInstance;
}

/**
 * Live isolated nervous-system runtime attached to every spawned animal entity.
 */
export interface CreatureBrainData {
  readonly speciesId: string;
  readonly bus: SignalBus;
  readonly layout: ResolvedBodyLayout;
  readonly appearanceFeatures?: AppearanceFeatures;
  readonly neuromodulators?: NeuromodulatorState;
  readonly modulatorHandles?: {
    readonly reward?: PortHandle;
    readonly aversive?: PortHandle;
  };
  readonly rng: SeededRng;
  readonly sensors: readonly MountedSensorRuntime[];
  readonly brainModules: readonly {
    readonly instanceId: string;
    readonly instance: BrainModuleInstance;
  }[];
  readonly spine: SpineInstance;
  readonly actuators: readonly MountedActuatorRuntime[];
  readonly scentEmission?: AnimalScentSpec;
}

/** ECS component storing an animal's live SignalBus, sensors, brain modules, spine, and actuators. */
export const CreatureBrainComponent = defineComponent<CreatureBrainData>(
  'creature-brain',
  'CreatureBrain',
);

const EMPTY_TAG_SET: ReadonlySet<string> = new Set<string>();

/**
 * Executes one complete deterministic nervous-system tick for every living animal in `world`:
 * 1. Samples mounted sensors according to their declared `sampleRateHz` (writing into `bus.next`;
 *    analog channels automatically hold their value across skipped sub-ticks).
 * 2. Ticks all brain modules (reading `bus.current`, writing `bus.next`).
 * 3. Ticks the species spine (reading `bus.current`, writing `bus.next`).
 * 4. Applies all actuators (reading `bus.current`, applying forces/torques, queueing energy costs,
 *    collecting discrete {@link ActuatorActionEvent}s such as bites).
 * 5. Swaps each animal's double-buffered `SignalBus` and emits body scent.
 *
 * Uses reusable per-tick context objects to minimize GC allocations in the hot loop (Section 7).
 *
 * @returns All discrete actuator action events emitted during this tick (pass to `stepInteractionSystem`).
 */
export function stepNervousSystem(world: World, dt: number): ActuatorActionEvent[] {
  assertFiniteNumber('dt', dt, 'stepNervousSystem');
  if (dt < 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number >= 0', 'stepNervousSystem');
  }
  if (dt === 0) return [];

  const events: ActuatorActionEvent[] = [];
  const creatures = world.ecs.query(
    CreatureBrainComponent,
    TransformComponent,
    PhysicsBodyComponent,
  );
  if (creatures.length === 0) return events;

  // Reusable mutable context state shared across entities during this tick (zero per-creature closures).
  const initialEntity = creatures[0] as EntityId;
  let currentRootBody = 0 as BodyHandle;
  let currentTargetBody = 0 as BodyHandle;
  let currentEnergy: EnergyData | undefined;
  const sensorPos = { x: 0, y: 0 };
  const actuatorPos = { x: 0, y: 0 };
  const bodyState: {
    energyRatio: number;
    healthRatio: number;
    painPulse: number;
    isMature: boolean;
    speciesId: string;
    reproductiveOrgan: NeighborReproductiveOrgan | undefined;
  } = {
    energyRatio: 1,
    healthRatio: 1,
    painPulse: 0,
    isMature: true,
    speciesId: '',
    reproductiveOrgan: undefined,
  };
  const neighborBuffer: NeighborObservation[] = [];

  const sensorCtx: {
    entityId: EntityId;
    position: Vec2;
    angle: number;
    bodyState: typeof bodyState;
    queryNeighbors: SensorContext['queryNeighbors'];
    sampleField: SensorContext['sampleField'];
    castRay: SensorContext['castRay'];
  } = {
    entityId: initialEntity,
    position: sensorPos,
    angle: 0,
    bodyState,
    queryNeighbors(origin, radiusMeters): readonly NeighborObservation[] {
      const ids = world.spatialHash.queryRadius(origin.x, origin.y, radiusMeters);
      neighborBuffer.length = 0;
      const ecs = world.ecs;
      for (let k = 0; k < ids.length; k += 1) {
        const otherId = ids[k] as EntityId;
        const oTransform = ecs.getComponent(otherId, TransformComponent);
        if (oTransform === undefined) continue;
        const oBody = ecs.getComponent(otherId, PhysicsBodyComponent);
        const oTags = ecs.getComponent(otherId, TagsComponent);
        const oBrain = ecs.getComponent(otherId, CreatureBrainComponent);
        const oOrgan = ecs.getComponent(otherId, ReproductiveOrganComponent);
        const reproductiveOrgan: NeighborReproductiveOrgan | undefined =
          oOrgan !== undefined && oBrain !== undefined
            ? {
                organId: oOrgan.organId,
                speciesId: oBrain.speciesId,
                worldPosition: computeOrganWorldPosition(
                  oTransform,
                  oTransform.angle,
                  oOrgan.localOffset,
                ),
                contactRadiusMeters: oOrgan.contactRadiusMeters,
              }
            : undefined;
        neighborBuffer.push({
          entityId: otherId,
          position: oTransform,
          radius: oBody?.boundingRadius ?? 0.1,
          tags: oTags?.values ?? EMPTY_TAG_SET,
          ...(oBrain?.appearanceFeatures !== undefined
            ? { appearanceFeatures: oBrain.appearanceFeatures }
            : {}),
          ...(reproductiveOrgan !== undefined ? { reproductiveOrgan } : {}),
        });
      }
      return neighborBuffer;
    },
    sampleField(fieldName, x, y) {
      return world.fields.has(fieldName) ? world.fields.get(fieldName).sampleBilinear(x, y) : 0;
    },
    castRay(origin, direction, maxDistance) {
      const hit = world.physics.castRay(origin, direction, maxDistance, currentRootBody);
      if (hit === null) return null;
      return {
        entityId: world.getEntityByBody(hit.body) ?? null,
        distance: hit.toi,
      };
    },
  };

  const actuatorCtx: {
    entityId: EntityId;
    worldPosition: Vec2;
    worldAngle: number;
    bodyScale: number;
    angularVelocity: number;
    applyForce: ActuatorContext['applyForce'];
    applyImpulse: ActuatorContext['applyImpulse'];
    applyTorque: ActuatorContext['applyTorque'];
    emitField: ActuatorContext['emitField'];
    consumeEnergy: ActuatorContext['consumeEnergy'];
    emitAction: ActuatorContext['emitAction'];
  } = {
    entityId: initialEntity,
    worldPosition: actuatorPos,
    worldAngle: 0,
    bodyScale: 1,
    angularVelocity: 0,
    applyForce(force, atWorldPoint) {
      world.physics.applyForce(currentTargetBody, force, atWorldPoint ?? actuatorPos);
    },
    applyImpulse(impulse, atWorldPoint) {
      world.physics.applyImpulse(currentTargetBody, impulse, atWorldPoint ?? actuatorPos);
    },
    applyTorque(torque) {
      world.physics.applyTorque(currentTargetBody, torque);
    },
    emitField(fieldName, x, y, delta) {
      if (world.fields.has(fieldName)) {
        world.fields.get(fieldName).addAtWorld(x, y, delta);
      }
    },
    consumeEnergy(energyUnits) {
      if (currentEnergy !== undefined && energyUnits > 0) {
        currentEnergy.pendingActuatorCost += energyUnits;
      }
    },
    emitAction(event) {
      events.push({
        ...event,
        origin: { x: event.origin.x, y: event.origin.y },
        direction: { x: event.direction.x, y: event.direction.y },
      });
    },
  };

  for (let c = 0; c < creatures.length; c += 1) {
    const entity = creatures[c] as EntityId;
    const health = world.ecs.getComponent(entity, HealthComponent);
    if (health !== undefined && health.dead) continue;

    const brain = world.ecs.requireComponent(entity, CreatureBrainComponent);
    const transform = world.ecs.requireComponent(entity, TransformComponent);
    const body = world.ecs.requireComponent(entity, PhysicsBodyComponent);
    const energy = world.ecs.getComponent(entity, EnergyComponent);
    const lifecycle = world.ecs.getComponent(entity, LifecycleComponent);
    const organ = world.ecs.getComponent(entity, ReproductiveOrganComponent);

    currentRootBody = body.bodyHandle;
    currentEnergy = energy;
    sensorCtx.entityId = entity;
    actuatorCtx.entityId = entity;

    bodyState.energyRatio =
      energy !== undefined && energy.max > 0 ? clamp(energy.current / energy.max, 0, 1) : 1;
    bodyState.healthRatio =
      health !== undefined && health.max > 0 ? clamp(health.current / health.max, 0, 1) : 1;
    bodyState.painPulse = health !== undefined ? clamp(health.recentPainPulse, 0, 1) : 0;
    bodyState.isMature =
      lifecycle === undefined || lifecycle.ageSeconds >= lifecycle.maturityAgeSeconds;
    bodyState.speciesId = brain.speciesId;

    if (organ !== undefined) {
      const ownOrganPos = computeOrganWorldPosition(transform, transform.angle, organ.localOffset);
      bodyState.reproductiveOrgan = {
        organId: organ.organId,
        speciesId: brain.speciesId,
        worldPosition: ownOrganPos,
        contactRadiusMeters: organ.contactRadiusMeters,
      };
      // Update lightweight complementary organ contact state (zero extra physics colliders)
      const contactScan = world.spatialHash.queryRadius(
        ownOrganPos.x,
        ownOrganPos.y,
        organ.contactRadiusMeters * 2.5 + body.boundingRadius,
      );
      let contactPartner: EntityId | null = null;
      for (let k = 0; k < contactScan.length; k += 1) {
        const otherId = contactScan[k] as EntityId;
        if (otherId === entity) continue;
        const otherOrgan = world.ecs.getComponent(otherId, ReproductiveOrganComponent);
        if (otherOrgan === undefined || !areOrgansComplementary(organ, otherOrgan)) continue;
        const otherBrain = world.ecs.getComponent(otherId, CreatureBrainComponent);
        if (otherBrain === undefined || otherBrain.speciesId !== brain.speciesId) continue;
        const otherTransform = world.ecs.getComponent(otherId, TransformComponent);
        if (otherTransform === undefined) continue;
        const otherPos = computeOrganWorldPosition(
          otherTransform,
          otherTransform.angle,
          otherOrgan.localOffset,
        );
        const dist = Math.hypot(otherPos.x - ownOrganPos.x, otherPos.y - ownOrganPos.y);
        if (dist <= organ.contactRadiusMeters + otherOrgan.contactRadiusMeters) {
          contactPartner = otherId;
          break;
        }
      }
      organ.inContact = contactPartner !== null;
      organ.contactPartnerId = contactPartner;
    } else {
      bodyState.reproductiveOrgan = undefined;
    }

    const read = brain.bus.reader;
    const write = brain.bus.writer;

    // Publish short-lived ADR 0010 neuromodulator pulses (reward / aversive) into subscribed channels
    if (brain.neuromodulators !== undefined) {
      if (bodyState.painPulse > 0 && bodyState.painPulse > brain.neuromodulators.aversive) {
        brain.neuromodulators.aversive = bodyState.painPulse;
      }
      if (brain.modulatorHandles?.reward !== undefined) {
        write.set(brain.modulatorHandles.reward, brain.neuromodulators.reward);
      }
      if (brain.modulatorHandles?.aversive !== undefined) {
        write.set(brain.modulatorHandles.aversive, brain.neuromodulators.aversive);
      }
      decayNeuromodulators(brain.neuromodulators, dt);
    }

    const cosA = Math.cos(transform.angle);
    const sinA = Math.sin(transform.angle);

    // 1. Sample mounted sensors (respecting declared sampleRateHz with deterministic per-entity staggering)
    for (let i = 0; i < brain.sensors.length; i += 1) {
      const mounted = brain.sensors[i] as MountedSensorRuntime;
      if (mounted.sampleRateHz !== undefined && mounted.sampleRateHz > 0) {
        const cooldown = mounted.sampleCooldownSeconds ?? 0;
        if (cooldown > 1e-9) {
          mounted.sampleCooldownSeconds = cooldown - dt;
          continue;
        }
        const period = 1 / mounted.sampleRateHz;
        if (!mounted.sampledOnce) {
          mounted.sampledOnce = true;
          const phaseTicks = Math.max(1, Math.round(period / dt));
          mounted.sampleCooldownSeconds = Math.max(0, (entity % phaseTicks) * dt);
        } else {
          mounted.sampleCooldownSeconds = Math.max(0, period - dt);
        }
      }

      const lx = mounted.localPosition.x;
      const ly = mounted.localPosition.y;
      sensorPos.x = transform.x + lx * cosA - ly * sinA;
      sensorPos.y = transform.y + lx * sinA + ly * cosA;
      sensorCtx.angle = transform.angle + mounted.localAngle;
      mounted.instance.sample(sensorCtx, write);
    }

    // 2. Tick brain modules (every tick so 1-tick inter-module pulse chains never drop)
    for (let i = 0; i < brain.brainModules.length; i += 1) {
      const mod = brain.brainModules[i] as (typeof brain.brainModules)[number];
      mod.instance.tick(read, write, dt);
    }

    // 3. Tick spine
    brain.spine.tick(read, write, dt);

    // 4. Apply actuators (scaled by physical layout scale with live angular-velocity feedback)
    actuatorCtx.bodyScale = brain.layout.scale;
    const rootAngularVelocity = world.physics.getBodyTransform(body.bodyHandle).angularVelocity;
    for (let i = 0; i < brain.actuators.length; i += 1) {
      const act = brain.actuators[i] as MountedActuatorRuntime;
      currentTargetBody = act.targetBody;
      const lx = act.localPosition.x;
      const ly = act.localPosition.y;
      actuatorPos.x = transform.x + lx * cosA - ly * sinA;
      actuatorPos.y = transform.y + lx * sinA + ly * cosA;
      actuatorCtx.worldAngle = transform.angle + act.localAngle;
      actuatorCtx.angularVelocity =
        act.targetBody === body.bodyHandle
          ? rootAngularVelocity
          : world.physics.getBodyTransform(act.targetBody).angularVelocity;
      act.instance.apply(actuatorCtx, read, dt);
    }

    // 5. Emit body scent and swap double-buffered SignalBus
    if (
      brain.scentEmission !== undefined &&
      brain.scentEmission.ratePerSecond > 0 &&
      world.fields.has(brain.scentEmission.field)
    ) {
      const field = world.fields.get(brain.scentEmission.field);
      const sx = clamp(transform.x, 0, Math.max(0, field.widthMeters - 1e-4));
      const sy = clamp(transform.y, 0, Math.max(0, field.heightMeters - 1e-4));
      field.addAtWorld(sx, sy, brain.scentEmission.ratePerSecond * dt);
    }

    brain.bus.swap();
  }

  return events;
}
