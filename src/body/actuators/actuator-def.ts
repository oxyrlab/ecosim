import type { PortHandleMap, PortMap, PortReader } from '@bus/ports';
import {
  assertKebabCaseId,
  createRegistry,
  InvalidParameterError,
  type ComponentMeta,
  type EntityId,
  type Registry,
  type Vec2,
} from '@core/index';
import type { PortMapOrFactory } from '../sensors/sensor-def';

/**
 * Energy expenditure model reported by every actuator (Section 5.3 & Section 5.8).
 * All values are in Energy Units (`EU`).
 */
export interface EnergyCostModel {
  /** Idle upkeep cost in `EU/s` (>= 0). */
  readonly basePerSecond: number;
  /** Effort-proportional cost in `EU/s` at full unit effort (>= 0). */
  readonly perUnitEffortPerSecond: number;
  /** Discrete one-shot energy cost per triggered action in `EU` (>= 0). */
  readonly perAction: number;
}

/**
 * Domain action emitted by discrete actuators (such as `bite`) for consumption by `InteractionSystem`
 * in Phase 3 without coupling actuators to `life/`.
 */
export type ActuatorActionEvent = {
  readonly kind: 'bite';
  readonly actorEntityId: EntityId;
  readonly origin: Vec2;
  readonly direction: Vec2;
  readonly rangeMeters: number;
  readonly damage: number;
};

/**
 * Physical & energy interface exposed to an actuator during `apply()`.
 * Forces applied by visual-part actuators automatically route to the nearest physical ancestor body.
 */
export interface ActuatorContext {
  /** Owning creature entity id. */
  readonly entityId: EntityId;
  /** World-space position of the part hosting this actuator (meters). */
  readonly worldPosition: Vec2;
  /** World-space orientation of the part hosting this actuator (radians). */
  readonly worldAngle: number;
  /** Applies a force in Newtons to the target physical body (default at `worldPosition`). */
  applyForce(force: Vec2, atWorldPoint?: Vec2): void;
  /** Applies an impulse in `N·s` to the target physical body (default at `worldPosition`). */
  applyImpulse(impulse: Vec2, atWorldPoint?: Vec2): void;
  /** Applies a torque in `N·m` to the target physical body. */
  applyTorque(torque: number): void;
  /** Emits a value into a named world field at `(x, y)` meters. */
  emitField(fieldName: string, x: number, y: number, delta: number): void;
  /** Deducts `energyUnits` (`EU`) from the creature's energy reserve. */
  consumeEnergy(energyUnits: number): void;
  /** Records a discrete actuator event (e.g. a bite attempt). */
  emitAction(event: ActuatorActionEvent): void;
}

/**
 * Runtime instance of an actuator hosted on a creature's body part.
 */
export interface ActuatorInstance {
  /** Reads commands from `input` and applies physical effects + energy cost over `dt` seconds. */
  apply(ctx: ActuatorContext, input: PortReader, dt: number): void;
}

/**
 * Self-describing definition of an actuator registered in {@link actuatorRegistry}.
 */
export interface ActuatorDef<P = unknown, I extends PortMap = PortMap> extends ComponentMeta<P> {
  /** Input command ports read by this actuator. */
  readonly inputs: PortMapOrFactory<P, I>;
  /** Computes the energy cost model for validated `params`. */
  energyCost(params: P): EnergyCostModel;
  /** Instantiates an actuator bound to pre-resolved input handles. */
  create(params: P, handles: { readonly inputs: PortHandleMap<I> }): ActuatorInstance;
}

/**
 * Global registry of actuator definitions.
 */
export const actuatorRegistry: Registry<ActuatorDef<unknown, PortMap>> =
  createRegistry<ActuatorDef<unknown, PortMap>>('actuator');

/**
 * Identity helper inferring parameter and input-port handle types for an {@link ActuatorDef}.
 */
export function defineActuator<P, I extends PortMap>(def: ActuatorDef<P, I>): ActuatorDef<P, I> {
  assertKebabCaseId(def.id, 'actuator id');
  if (def.description.trim().length === 0) {
    throw new InvalidParameterError(
      'description',
      def.description,
      'a non-empty string',
      `defineActuator(${def.id})`,
    );
  }
  return def;
}

/**
 * Registers an {@link ActuatorDef} into `registry` (defaults to {@link actuatorRegistry}).
 */
export function registerActuator<P, I extends PortMap>(
  def: ActuatorDef<P, I>,
  registry: Registry<ActuatorDef<unknown, PortMap>> = actuatorRegistry,
): ActuatorDef<P, I> {
  defineActuator(def);
  registry.register(def as ActuatorDef<unknown, PortMap>);
  return def;
}
