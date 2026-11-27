import type { AppearanceFeatures } from '@appearance/features';
import type { ResolvedBodyLayout } from '@appearance/types';
import type { ActuatorActionEvent, ActuatorInstance } from '@body/actuators';
import type { NeighborObservation, SensorInstance } from '@body/sensors';
import {
  decayNeuromodulators,
  type BrainModuleInstance,
  type NeuromodulatorState,
} from '@brain/index';
import type { PortHandle } from '@bus/ports';
import type { SignalBus } from '@bus/signal-bus';
import {
  add,
  assertFiniteNumber,
  clamp,
  defineComponent,
  InvalidParameterError,
  rotate,
  type SeededRng,
  type Vec2,
} from '@core/index';
import { EnergyComponent, HealthComponent } from '@life/index';
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

/**
 * Executes one complete deterministic nervous-system tick for every living animal in `world`:
 * 1. Samples all sensors (writing into `bus.next`).
 * 2. Ticks all brain modules (reading `bus.current`, writing `bus.next`).
 * 3. Ticks the species spine (reading `bus.current`, writing `bus.next`).
 * 4. Applies all actuators (reading `bus.current`, applying forces/torques, queueing energy costs,
 *    collecting discrete {@link ActuatorActionEvent}s such as bites).
 * 5. Swaps each animal's double-buffered `SignalBus` and emits body scent.
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

  for (const entity of creatures) {
    const health = world.ecs.getComponent(entity, HealthComponent);
    if (health !== undefined && health.dead) continue;

    const brain = world.ecs.requireComponent(entity, CreatureBrainComponent);
    const transform = world.ecs.requireComponent(entity, TransformComponent);
    const body = world.ecs.requireComponent(entity, PhysicsBodyComponent);
    const energy = world.ecs.getComponent(entity, EnergyComponent);

    const energyRatio =
      energy !== undefined && energy.max > 0 ? clamp(energy.current / energy.max, 0, 1) : 1;
    const healthRatio =
      health !== undefined && health.max > 0 ? clamp(health.current / health.max, 0, 1) : 1;
    const painPulse = health !== undefined ? clamp(health.recentPainPulse, 0, 1) : 0;

    const read = brain.bus.reader;
    const write = brain.bus.writer;

    // Publish short-lived ADR 0010 neuromodulator pulses (reward / aversive) into subscribed channels
    if (brain.neuromodulators !== undefined) {
      if (painPulse > 0 && painPulse > brain.neuromodulators.aversive) {
        brain.neuromodulators.aversive = painPulse;
      }
      if (brain.modulatorHandles?.reward !== undefined) {
        write.set(brain.modulatorHandles.reward, brain.neuromodulators.reward);
      }
      if (brain.modulatorHandles?.aversive !== undefined) {
        write.set(brain.modulatorHandles.aversive, brain.neuromodulators.aversive);
      }
      decayNeuromodulators(brain.neuromodulators, dt);
    }

    // 1. Sample mounted sensors
    const rootPos: Vec2 = { x: transform.x, y: transform.y };
    for (let i = 0; i < brain.sensors.length; i += 1) {
      const mounted = brain.sensors[i] as MountedSensorRuntime;
      const worldPos = add(rootPos, rotate(mounted.localPosition, transform.angle));
      const worldAngle = transform.angle + mounted.localAngle;

      mounted.instance.sample(
        {
          entityId: entity,
          position: worldPos,
          angle: worldAngle,
          bodyState: { energyRatio, healthRatio, painPulse },
          queryNeighbors(origin, radiusMeters): readonly NeighborObservation[] {
            const ids = world.spatialHash.queryRadius(origin.x, origin.y, radiusMeters);
            const result: NeighborObservation[] = [];
            for (const otherId of ids) {
              if (!world.ecs.isAlive(otherId)) continue;
              const oTransform = world.ecs.getComponent(otherId, TransformComponent);
              if (oTransform === undefined) continue;
              const oBody = world.ecs.getComponent(otherId, PhysicsBodyComponent);
              const oTags = world.ecs.getComponent(otherId, TagsComponent);
              const oBrain = world.ecs.getComponent(otherId, CreatureBrainComponent);
              result.push({
                entityId: otherId,
                position: { x: oTransform.x, y: oTransform.y },
                radius: oBody?.boundingRadius ?? 0.1,
                tags: oTags?.values ?? new Set<string>(),
                ...(oBrain?.appearanceFeatures !== undefined
                  ? { appearanceFeatures: oBrain.appearanceFeatures }
                  : {}),
              });
            }
            return result;
          },
          sampleField(fieldName, x, y) {
            return world.fields.has(fieldName)
              ? world.fields.get(fieldName).sampleBilinear(x, y)
              : 0;
          },
          castRay(origin, direction, maxDistance) {
            const hit = world.physics.castRay(origin, direction, maxDistance, body.bodyHandle);
            if (hit === null) return null;
            return {
              entityId: world.getEntityByBody(hit.body) ?? null,
              distance: hit.toi,
            };
          },
        },
        write,
      );
    }

    // 2. Tick brain modules
    for (let i = 0; i < brain.brainModules.length; i += 1) {
      const mod = brain.brainModules[i] as (typeof brain.brainModules)[number];
      mod.instance.tick(read, write, dt);
    }

    // 3. Tick spine
    brain.spine.tick(read, write, dt);

    // 4. Apply actuators
    for (let i = 0; i < brain.actuators.length; i += 1) {
      const act = brain.actuators[i] as MountedActuatorRuntime;
      const worldPos = add(rootPos, rotate(act.localPosition, transform.angle));
      const worldAngle = transform.angle + act.localAngle;

      act.instance.apply(
        {
          entityId: entity,
          worldPosition: worldPos,
          worldAngle,
          applyForce(force, atWorldPoint) {
            world.physics.applyForce(act.targetBody, force, atWorldPoint ?? worldPos);
          },
          applyImpulse(impulse, atWorldPoint) {
            world.physics.applyImpulse(act.targetBody, impulse, atWorldPoint ?? worldPos);
          },
          applyTorque(torque) {
            world.physics.applyTorque(act.targetBody, torque);
          },
          emitField(fieldName, x, y, delta) {
            if (world.fields.has(fieldName)) {
              world.fields.get(fieldName).addAtWorld(x, y, delta);
            }
          },
          consumeEnergy(energyUnits) {
            if (energy !== undefined && energyUnits > 0) {
              energy.pendingActuatorCost += energyUnits;
            }
          },
          emitAction(event) {
            events.push(event);
          },
        },
        read,
        dt,
      );
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
