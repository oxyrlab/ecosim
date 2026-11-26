import { defineComponent } from '@core/index';

/**
 * Cause of death recorded when an entity transitions from living to dead.
 */
export type DeathCause = 'none' | 'starvation' | 'damage' | 'aging';

/**
 * Energy store and metabolic parameters for any living entity (all energy in SI `EU`).
 */
export interface EnergyData {
  /** Current stored energy in `EU` (`0 <= current <= max`). */
  current: number;
  /** Maximum energy storage capacity in `EU` (> 0). */
  readonly max: number;
  /** Structural body mass in kilograms (> 0), scaling basal metabolic cost. */
  readonly massKg: number;
  /** Basal metabolic consumption rate in `EU / (kg · s)` (>= 0). */
  readonly basalRatePerKgPerSecond: number;
  /** Continuous brain upkeep cost in `EU / s` (>= 0). */
  readonly brainUpkeepPerSecond: number;
  /** Accumulated actuator energy cost queued during the current tick in `EU` (>= 0). */
  pendingActuatorCost: number;
  /** Health damage per second suffered while `current === 0` (`HP / s`, >= 0). */
  readonly starvationDamagePerSecond: number;
  /** Structural energy locked in body biomass released when converting into a corpse (`EU`, >= 0). */
  readonly structuralEnergy: number;
}

/**
 * Lifecycle, growth scaling, and senescence state for an entity (all times in SI seconds).
 */
export interface LifecycleData {
  /** Current age in seconds (>= 0). */
  ageSeconds: number;
  /** Maximum lifespan in seconds (> 0); reaching it causes death by aging. */
  readonly maxAgeSeconds: number;
  /** Age at which the creature reaches adult scale in seconds (`0 < maturity <= maxAge`). */
  readonly maturityAgeSeconds: number;
  /** Body scale multiplier at birth (`> 0`). */
  readonly juvenileScale: number;
  /** Body scale multiplier at maturity (`>= juvenileScale`). */
  readonly adultScale: number;
  /** Fraction of `maxAgeSeconds` after which metabolic efficiency declines (`[0, 1]`). */
  readonly senescenceStartFraction: number;
  /** Floor metabolic efficiency reached at `maxAgeSeconds` (`(0, 1]`). */
  readonly minSenescenceEfficiency: number;
  /** Current computed growth scale multiplier. */
  currentScale: number;
  /** Current metabolic efficiency in `(0, 1]`. */
  efficiency: number;
}

/**
 * Health, incoming damage, pain pulse, and mortality state of an entity.
 */
export interface HealthData {
  /** Current health points (`0 <= current <= max`). */
  current: number;
  /** Maximum health points (> 0). */
  readonly max: number;
  /** Damage queued during the current tick, resolved by `HealthSystem`. */
  pendingDamage: number;
  /** Normalized `[0, 1]` pain spike from damage taken this tick (read by `pain-sensor`). */
  recentPainPulse: number;
  /** Whether the entity is dead and awaiting conversion by `DeathSystem`. */
  dead: boolean;
  /** Cause of death once `dead === true`. */
  deathCause: DeathCause;
  /** Energy units transferred per point of bite damage dealt to this entity (`EU / HP`). */
  readonly energyPerDamage: number;
}

/**
 * Feeding assimilation properties of an animal capable of biting/eating.
 */
export interface DietData {
  /** Fraction of ingested energy retained by the consumer in `(0, 1]` (rest is metabolic waste). */
  readonly assimilationEfficiency: number;
  /** Tags this creature can feed upon (e.g. `['plant', 'fruit']` or `['prey', 'corpse']`). */
  readonly edibleTags: readonly string[];
}

/**
 * Decomposing corpse holding residual energy that gradually releases into `soil.nutrients`
 * and emits `scent.corpse`.
 */
export interface CorpseData {
  /** Remaining decomposable energy in `EU` (>= 0). */
  energy: number;
  /** Initial corpse energy at time of death in `EU` (> 0). */
  readonly initialEnergy: number;
  /** Decomposition rate in `EU / s` (> 0). */
  readonly decayRatePerSecond: number;
  /** Scent emission rate into `scent.corpse` per second (>= 0). */
  readonly scentRatePerSecond: number;
  /** Physical/visual radius in meters (> 0). */
  readonly radius: number;
}

/** ECS component storing metabolic energy reserves and upkeep parameters. */
export const EnergyComponent = defineComponent<EnergyData>('energy', 'Energy');

/** ECS component storing age, growth scaling, and senescence parameters. */
export const LifecycleComponent = defineComponent<LifecycleData>('lifecycle', 'Lifecycle');

/** ECS component storing health, damage queue, pain pulse, and death state. */
export const HealthComponent = defineComponent<HealthData>('health', 'Health');

/** ECS component storing feeding assimilation efficiency and edible tags. */
export const DietComponent = defineComponent<DietData>('diet', 'Diet');

/** ECS component marking a decomposing corpse entity. */
export const CorpseComponent = defineComponent<CorpseData>('corpse', 'Corpse');
