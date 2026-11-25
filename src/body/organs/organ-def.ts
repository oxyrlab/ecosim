import type { ShapeSpec } from '@appearance/types';
import {
  assertKebabCaseId,
  createRegistry,
  InvalidParameterError,
  type ComponentMeta,
  type Registry,
} from '@core/index';

/**
 * Self-describing definition of a physical body organ registered in {@link organRegistry}.
 */
export interface OrganDef<P = Record<string, never>> extends ComponentMeta<P> {
  /** Default primitive shape used when not overridden in a Blueprint. */
  readonly defaultShape: ShapeSpec;
  /** Default number of sensors this organ can host (>= 0). */
  readonly sensorSlots: number;
  /** Whether this organ may host an actuator. */
  readonly actuatorSlot: boolean;
  /** Mass density in `kg/m^2` (> 0). */
  readonly massDensity: number;
}

/**
 * Global registry of organ definitions.
 */
export const organRegistry: Registry<OrganDef<unknown>> =
  createRegistry<OrganDef<unknown>>('organ');

/**
 * Identity helper inferring parameter types and validating metadata for an {@link OrganDef}.
 */
export function defineOrgan<P>(def: OrganDef<P>): OrganDef<P> {
  assertKebabCaseId(def.id, 'organ id');
  if (def.description.trim().length === 0) {
    throw new InvalidParameterError(
      'description',
      def.description,
      'a non-empty string',
      `defineOrgan(${def.id})`,
    );
  }
  if (!Number.isInteger(def.sensorSlots) || def.sensorSlots < 0) {
    throw new InvalidParameterError(
      'sensorSlots',
      def.sensorSlots,
      'an integer >= 0',
      `defineOrgan(${def.id})`,
    );
  }
  if (!Number.isFinite(def.massDensity) || def.massDensity <= 0) {
    throw new InvalidParameterError(
      'massDensity',
      def.massDensity,
      'a finite number > 0',
      `defineOrgan(${def.id})`,
    );
  }
  return def;
}

/**
 * Registers an {@link OrganDef} into `registry` (defaults to {@link organRegistry}).
 */
export function registerOrgan<P>(
  def: OrganDef<P>,
  registry: Registry<OrganDef<unknown>> = organRegistry,
): OrganDef<P> {
  defineOrgan(def);
  registry.register(def as OrganDef<unknown>);
  return def;
}
