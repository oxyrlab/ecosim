import type { AppearanceFeatures } from '@appearance/features';
import type { PortHandleMap, PortMap, PortWriter } from '@bus/ports';
import {
  assertKebabCaseId,
  createRegistry,
  InvalidParameterError,
  type ComponentMeta,
  type EntityId,
  type Registry,
  type Vec2,
} from '@core/index';

/**
 * Read-only observation of a nearby entity returned by {@link SensorContext.queryNeighbors}.
 */
export interface NeighborObservation {
  readonly entityId: EntityId;
  readonly position: Vec2;
  readonly radius: number;
  readonly tags: ReadonlySet<string>;
  /** Optional normalized appearance features for feature-based vision learning (Phase 6). */
  readonly appearanceFeatures?: AppearanceFeatures;
}

/**
 * Read-only raycast hit exposed to sensors for optional vision occlusion.
 */
export interface SensorRaycastHit {
  readonly entityId: EntityId | null;
  readonly distance: number;
}

/**
 * Read-only internal proprioceptive body metrics exposed to internal sensors (energy, pain).
 */
export interface InternalBodyState {
  /** Normalized remaining energy `current / max` in `[0, 1]`. */
  readonly energyRatio: number;
  /** Normalized remaining health `current / max` in `[0, 1]`. */
  readonly healthRatio: number;
  /** One-tick normalized pain spike in `[0, 1]` from recent damage. */
  readonly painPulse: number;
}

/**
 * Strictly read-only world and body view injected into every sensor during `sample()`.
 */
export interface SensorContext {
  /** Owning creature entity id. */
  readonly entityId: EntityId;
  /** World-space sensor mount position in meters. */
  readonly position: Vec2;
  /** World-space sensor forward orientation in radians. */
  readonly angle: number;
  /** Optional internal metabolic/health state for proprioceptive sensors (`energy-sensor`, `pain-sensor`). */
  readonly bodyState?: InternalBodyState;
  /** Queries nearby entities within `radiusMeters` using the world's `SpatialHash`. */
  queryNeighbors(origin: Vec2, radiusMeters: number): readonly NeighborObservation[];
  /** Samples a named `GridField` at `(x, y)` meters via bilinear interpolation. */
  sampleField(fieldName: string, x: number, y: number): number;
  /** Casts a ray from `origin` along `direction` up to `maxDistance` meters (excluding self). */
  castRay(origin: Vec2, direction: Vec2, maxDistance: number): SensorRaycastHit | null;
}

/**
 * Runtime instance of a sensor hosted on a creature's body part.
 */
export interface SensorInstance {
  /** Samples `ctx` and writes results into the creature's `SignalBus` via pre-resolved handles. */
  sample(ctx: SensorContext, out: PortWriter): void;
}

/**
 * Static or parameter-dependent port map declaration.
 */
export type PortMapOrFactory<P, M extends PortMap> = M | ((params: P) => M);

/**
 * Resolves a static or param-dependent port map into a concrete {@link PortMap}.
 */
export function resolvePortMap<P, M extends PortMap>(spec: PortMapOrFactory<P, M>, params: P): M {
  return typeof spec === 'function' ? spec(params) : spec;
}

/**
 * Self-describing definition of a sensor registered in {@link sensorRegistry}.
 */
export interface SensorDef<P = unknown, O extends PortMap = PortMap> extends ComponentMeta<P> {
  /** Output ports written by this sensor (static map or function of validated `params`). */
  readonly outputs: PortMapOrFactory<P, O>;
  /** Optional default sampling rate in Hz. */
  readonly sampleRateHz?: number;
  /** Instantiates a sensor bound to pre-resolved output handles. */
  create(params: P, handles: { readonly outputs: PortHandleMap<O> }): SensorInstance;
}

/**
 * Global registry of sensor definitions.
 */
export const sensorRegistry: Registry<SensorDef<unknown, PortMap>> =
  createRegistry<SensorDef<unknown, PortMap>>('sensor');

/**
 * Identity helper inferring parameter and output-port handle types for a {@link SensorDef}.
 */
export function defineSensor<P, O extends PortMap>(def: SensorDef<P, O>): SensorDef<P, O> {
  assertKebabCaseId(def.id, 'sensor id');
  if (def.description.trim().length === 0) {
    throw new InvalidParameterError(
      'description',
      def.description,
      'a non-empty string',
      `defineSensor(${def.id})`,
    );
  }
  return def;
}

/**
 * Registers a {@link SensorDef} into `registry` (defaults to {@link sensorRegistry}).
 */
export function registerSensor<P, O extends PortMap>(
  def: SensorDef<P, O>,
  registry: Registry<SensorDef<unknown, PortMap>> = sensorRegistry,
): SensorDef<P, O> {
  defineSensor(def);
  registry.register(def as SensorDef<unknown, PortMap>);
  return def;
}
