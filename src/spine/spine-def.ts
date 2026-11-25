import type { PortMapOrFactory } from '@body/sensors/sensor-def';
import type { PortHandleMap, PortMap, PortReader, PortWriter } from '@bus/ports';
import {
  assertKebabCaseId,
  createRegistry,
  InvalidParameterError,
  type ComponentMeta,
  type Registry,
} from '@core/index';

/**
 * Runtime spine instance translating high-level motor patterns into concrete actuator commands
 * (and optional reflexes).
 */
export interface SpineInstance {
  /** Runs one spine translation step over `dt` seconds. */
  tick(input: PortReader, output: PortWriter, dt: number): void;
}

/**
 * Self-describing definition of a spine registered in {@link spineRegistry}.
 */
export interface SpineDef<
  P = unknown,
  I extends PortMap = PortMap,
  O extends PortMap = PortMap,
> extends ComponentMeta<P> {
  /** Motor pattern inputs from the brain (and optional reflex sensor inputs). */
  readonly inputs: PortMapOrFactory<P, I>;
  /** Concrete actuator command outputs. */
  readonly outputs: PortMapOrFactory<P, O>;
  /** Instantiates a spine bound to pre-resolved input/output handles. */
  create(
    params: P,
    handles: { readonly inputs: PortHandleMap<I>; readonly outputs: PortHandleMap<O> },
  ): SpineInstance;
}

/**
 * Global registry of spine definitions.
 */
export const spineRegistry: Registry<SpineDef<unknown, PortMap, PortMap>> =
  createRegistry<SpineDef<unknown, PortMap, PortMap>>('spine');

/**
 * Identity helper inferring parameter and handle types for a {@link SpineDef}.
 */
export function defineSpine<P, I extends PortMap, O extends PortMap>(
  def: SpineDef<P, I, O>,
): SpineDef<P, I, O> {
  assertKebabCaseId(def.id, 'spine id');
  if (def.description.trim().length === 0) {
    throw new InvalidParameterError(
      'description',
      def.description,
      'a non-empty string',
      `defineSpine(${def.id})`,
    );
  }
  return def;
}

/**
 * Registers a {@link SpineDef} into `registry` (defaults to {@link spineRegistry}).
 */
export function registerSpine<P, I extends PortMap, O extends PortMap>(
  def: SpineDef<P, I, O>,
  registry: Registry<SpineDef<unknown, PortMap, PortMap>> = spineRegistry,
): SpineDef<P, I, O> {
  defineSpine(def);
  registry.register(def as SpineDef<unknown, PortMap, PortMap>);
  return def;
}
