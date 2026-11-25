import type { PortMapOrFactory } from '@body/sensors/sensor-def';
import type { PortHandle, PortHandleMap, PortMap, PortReader, PortWriter } from '@bus/ports';
import {
  assertKebabCaseId,
  createRegistry,
  InvalidParameterError,
  type ComponentMeta,
  type Registry,
  type SeededRng,
} from '@core/index';

/**
 * Behavioral architecture category of a {@link BrainModuleDef} (Section 5.3).
 */
export type BrainModuleKind = 'rule' | 'fsm' | 'utility' | 'nn' | 'hybrid' | 'learning';

/**
 * Pre-resolved port and hormone handles injected into `BrainModuleDef.create()`.
 */
export interface BrainModuleHandles<I extends PortMap, O extends PortMap> {
  readonly inputs: PortHandleMap<I>;
  readonly outputs: PortHandleMap<O>;
  readonly publish: Readonly<Record<string, PortHandle>>;
  readonly subscribe: Readonly<Record<string, PortHandle>>;
}

/**
 * Isolated runtime brain module communicating exclusively through `SignalBus` handles.
 */
export interface BrainModuleInstance {
  /** Executes one module step over `dt` seconds. */
  tick(input: PortReader, output: PortWriter, dt: number): void;
  /** Optional serializable internal state for Inspector UI and snapshots. */
  serialize?(): unknown;
}

/**
 * Self-describing definition of a brain module registered in {@link brainModuleRegistry}.
 */
export interface BrainModuleDef<
  P = unknown,
  I extends PortMap = PortMap,
  O extends PortMap = PortMap,
> extends ComponentMeta<P> {
  /** Architectural category (`rule`, `fsm`, `utility`, `nn`, `hybrid`, `learning`). */
  readonly kind: BrainModuleKind;
  /** Declared input ports (static map or function of validated `params`). */
  readonly inputs: PortMapOrFactory<P, I>;
  /** Declared output ports (static map or function of validated `params`). */
  readonly outputs: PortMapOrFactory<P, O>;
  /** Optional broadcast hormone channels published by this module. */
  readonly publish?: readonly string[];
  /** Optional broadcast hormone channels subscribed to by this module. */
  readonly subscribe?: readonly string[];
  /** Optional tick frequency in Hz (defaults to `SIMULATION_DEFAULTS.brainRateHz`). */
  readonly tickRateHz?: number;
  /** Instantiates the module with validated `params`, pre-resolved handles, and entity `rng`. */
  create(params: P, handles: BrainModuleHandles<I, O>, rng: SeededRng): BrainModuleInstance;
}

/**
 * Global registry of brain module definitions.
 */
export const brainModuleRegistry: Registry<BrainModuleDef<unknown, PortMap, PortMap>> =
  createRegistry<BrainModuleDef<unknown, PortMap, PortMap>>('brain-module');

/**
 * Identity helper inferring parameter and handle types for a {@link BrainModuleDef}.
 */
export function defineBrainModule<P, I extends PortMap, O extends PortMap>(
  def: BrainModuleDef<P, I, O>,
): BrainModuleDef<P, I, O> {
  assertKebabCaseId(def.id, 'brain module id');
  if (def.description.trim().length === 0) {
    throw new InvalidParameterError(
      'description',
      def.description,
      'a non-empty string',
      `defineBrainModule(${def.id})`,
    );
  }
  return def;
}

/**
 * Registers a {@link BrainModuleDef} into `registry` (defaults to {@link brainModuleRegistry}).
 */
export function registerBrainModule<P, I extends PortMap, O extends PortMap>(
  def: BrainModuleDef<P, I, O>,
  registry: Registry<BrainModuleDef<unknown, PortMap, PortMap>> = brainModuleRegistry,
): BrainModuleDef<P, I, O> {
  defineBrainModule(def);
  registry.register(def as BrainModuleDef<unknown, PortMap, PortMap>);
  return def;
}
