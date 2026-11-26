import { z } from 'zod';
import type { BodyPartSpec } from '@appearance/types';
import type { WireSpec } from '@bus/wiring';
import {
  assertKebabCaseId,
  createRegistry,
  InvalidParameterError,
  type Registry,
} from '@core/index';
import { plantSpeciesSpecSchema, type PlantSpeciesSpec } from '@plants/components';
import type { RuleOverride } from '@rules/types';

/**
 * Metabolic parameters declared inside an animal {@link AnimalSpeciesBlueprint}.
 */
export interface AnimalMetabolismSpec {
  /** Initial usable energy on spawn (`EU`). */
  readonly initialEnergy: number;
  /** Maximum energy storage capacity (`EU`). */
  readonly maxEnergy: number;
  /** Structural biomass energy released into corpse on death (`EU`). */
  readonly structuralEnergy: number;
  /** Basal metabolic consumption rate (`EU / (kg · s)`). */
  readonly basalRatePerKgPerSecond: number;
  /** Continuous brain upkeep per module (`EU / s`). */
  readonly brainUpkeepPerModulePerSecond: number;
  /** Health damage per second suffered when starving (`HP / s`). */
  readonly starvationDamagePerSecond: number;
}

/**
 * Feeding assimilation and edible-tag rules declared on an animal Blueprint.
 */
export interface AnimalDietSpec {
  /** Fraction of ingested energy assimilated into reserves in `(0, 1]`. */
  readonly assimilationEfficiency: number;
  /** Tags this species is able to bite/eat. */
  readonly edibleTags: readonly string[];
}

/**
 * Lifecycle, growth, health, and senescence parameters declared on an animal Blueprint.
 */
export interface AnimalLifecycleSpec {
  /** Maximum lifespan in seconds. */
  readonly maxAgeSeconds: number;
  /** Age at which full adult scale is reached in seconds. */
  readonly maturityAgeSeconds: number;
  /** Body scale multiplier at birth. */
  readonly juvenileScale: number;
  /** Body scale multiplier at maturity. */
  readonly adultScale: number;
  /** Fraction of `maxAgeSeconds` at which senescence efficiency decline begins. */
  readonly senescenceStartFraction: number;
  /** Minimum metabolic efficiency reached at `maxAgeSeconds`. */
  readonly minSenescenceEfficiency: number;
  /** Maximum health points (`HP`). */
  readonly maxHealth: number;
  /** Energy units transferred per point of bite damage received by this species. */
  readonly energyPerDamage: number;
}

/**
 * Scent field emission parameters for a living animal.
 */
export interface AnimalScentSpec {
  /** Target world field name (e.g. `'scent.prey'` or `'scent.predator'`). */
  readonly field: string;
  /** Emission rate per second (`units / s`). */
  readonly ratePerSecond: number;
}

/**
 * Brain module instance declaration inside an {@link AnimalSpeciesBlueprint}.
 */
export interface BrainModuleInstanceSpec {
  readonly instanceId: string;
  readonly module: string;
  readonly params?: unknown;
}

/**
 * Spine instance declaration inside an {@link AnimalSpeciesBlueprint}.
 */
export interface SpineInstanceSpec {
  readonly instanceId: string;
  readonly spine: string;
  readonly params?: unknown;
}

/**
 * Complete species blueprint for an animal (`kingdom: 'animal'`) with body part tree, brain
 * modules, spine, SignalBus wiring, metabolism, diet, and lifecycle (Section 5.4).
 */
export interface AnimalSpeciesBlueprint {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kingdom: 'animal';
  readonly tags: readonly string[];
  readonly stubColor: number;
  readonly body: {
    readonly parts: readonly BodyPartSpec[];
  };
  readonly ruleOverrides?: readonly RuleOverride[];
  readonly brain: {
    readonly modules: readonly BrainModuleInstanceSpec[];
  };
  readonly spine: SpineInstanceSpec;
  readonly wiring: readonly WireSpec[];
  readonly metabolism: AnimalMetabolismSpec;
  readonly diet: AnimalDietSpec;
  readonly lifecycle: AnimalLifecycleSpec;
  readonly scentEmission?: AnimalScentSpec;
}

/**
 * Complete species blueprint for a plant (`kingdom: 'plant'`) with no brain or spine.
 */
export interface PlantSpeciesBlueprint {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kingdom: 'plant';
  readonly tags: readonly string[];
  readonly plantSpec: PlantSpeciesSpec;
}

/**
 * Discriminated union of all EcoSim species blueprints.
 */
export type SpeciesBlueprint = AnimalSpeciesBlueprint | PlantSpeciesBlueprint;

const animalMetabolismSchema = z.object({
  initialEnergy: z.number().finite().positive(),
  maxEnergy: z.number().finite().positive(),
  structuralEnergy: z.number().finite().nonnegative(),
  basalRatePerKgPerSecond: z.number().finite().nonnegative(),
  brainUpkeepPerModulePerSecond: z.number().finite().nonnegative(),
  starvationDamagePerSecond: z.number().finite().nonnegative(),
});

const animalDietSchema = z.object({
  assimilationEfficiency: z.number().finite().gt(0).max(1),
  edibleTags: z.array(z.string().min(1)).min(1),
});

const animalLifecycleSchema = z.object({
  maxAgeSeconds: z.number().finite().positive(),
  maturityAgeSeconds: z.number().finite().positive(),
  juvenileScale: z.number().finite().positive(),
  adultScale: z.number().finite().positive(),
  senescenceStartFraction: z.number().finite().min(0).max(1),
  minSenescenceEfficiency: z.number().finite().gt(0).max(1),
  maxHealth: z.number().finite().positive(),
  energyPerDamage: z.number().finite().nonnegative(),
});

const animalScentSchema = z.object({
  field: z.string().min(1),
  ratePerSecond: z.number().finite().nonnegative(),
});

const wireSpecSchema = z.union([
  z.object({
    from: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    to: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  }),
  z.object({
    bundle: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
  }),
]);

/**
 * Structural Zod schema validating the top-level fields of an animal or plant Blueprint.
 */
export const speciesBlueprintSchema = z.discriminatedUnion('kingdom', [
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    kingdom: z.literal('animal'),
    tags: z.array(z.string().min(1)).min(1),
    stubColor: z.number().int().nonnegative(),
    body: z.object({
      parts: z.array(z.unknown()).min(1),
    }),
    ruleOverrides: z.array(z.unknown()).optional(),
    brain: z.object({
      modules: z.array(
        z.object({
          instanceId: z.string().min(1),
          module: z.string().min(1),
          params: z.unknown().optional(),
        }),
      ),
    }),
    spine: z.object({
      instanceId: z.string().min(1),
      spine: z.string().min(1),
      params: z.unknown().optional(),
    }),
    wiring: z.array(wireSpecSchema),
    metabolism: animalMetabolismSchema,
    diet: animalDietSchema,
    lifecycle: animalLifecycleSchema,
    scentEmission: animalScentSchema.optional(),
  }),
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    kingdom: z.literal('plant'),
    tags: z.array(z.string().min(1)).min(1),
    plantSpec: plantSpeciesSpecSchema,
  }),
]);

/**
 * Global registry of EcoSim species blueprints.
 */
export const speciesRegistry: Registry<SpeciesBlueprint> =
  createRegistry<SpeciesBlueprint>('species');

/**
 * Validates and defines a {@link SpeciesBlueprint} without mutating the global registry.
 */
export function defineSpecies<T extends SpeciesBlueprint>(blueprint: T): T {
  assertKebabCaseId(blueprint.id, 'species id');
  if (blueprint.description.trim().length === 0) {
    throw new InvalidParameterError(
      'description',
      blueprint.description,
      'a non-empty string',
      `defineSpecies(${blueprint.id})`,
    );
  }
  speciesBlueprintSchema.parse(blueprint);
  return blueprint;
}

/**
 * Validates and registers a {@link SpeciesBlueprint} into `registry` (defaults to {@link speciesRegistry}).
 */
export function registerSpecies<T extends SpeciesBlueprint>(
  blueprint: T,
  registry: Registry<SpeciesBlueprint> = speciesRegistry,
): T {
  defineSpecies(blueprint);
  registry.register(blueprint);
  return blueprint;
}
