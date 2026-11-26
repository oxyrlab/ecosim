import { z } from 'zod';
import { defineComponent, type EntityId, type Vec2 } from '@core/index';

/**
 * Ordered lifecycle stages of a plant entity (Section 5.9).
 */
export type PlantStage = 'seed' | 'sprout' | 'mature' | 'flowering' | 'fruiting' | 'senescence';

/**
 * Growing morphological organ dimensions of an individual plant.
 */
export interface PlantOrgans {
  /** Stem height/length in meters (>= 0). */
  stemLength: number;
  /** Photosynthetic leaf surface area in square meters (>= 0). */
  leafArea: number;
  /** Number of active blossoms (>= 0). */
  flowerCount: number;
}

/**
 * Zod schema validating a {@link PlantSpeciesSpec}.
 */
export const plantSpeciesSpecSchema = z.object({
  speciesId: z.string().min(1),
  seedRadius: z.number().positive().default(0.08),
  adultRadius: z.number().positive().default(0.45),
  maxEnergy: z.number().positive().default(60),
  seedEnergy: z.number().positive().default(4),
  structuralEnergy: z.number().nonnegative().default(5),
  basalRatePerKgPerSecond: z.number().nonnegative().default(0.05),
  massKg: z.number().positive().default(1),
  photosynthesisRatePerArea: z.number().positive().default(6),
  nutrientFraction: z.number().min(0).max(1).default(0.25),
  minMoistureToGrow: z.number().min(0).max(1).default(0.1),
  minLightToGrow: z.number().min(0).max(1).default(0.1),
  germinationDelaySeconds: z.number().nonnegative().default(2),
  crowdingRadiusMeters: z.number().nonnegative().default(0.6),
  maxNeighborsToGerminate: z.number().int().nonnegative().default(3),
  sproutToMatureAgeSeconds: z.number().positive().default(6),
  sproutToMatureEnergy: z.number().positive().default(14),
  matureToFloweringAgeSeconds: z.number().positive().default(10),
  matureToFloweringEnergy: z.number().positive().default(24),
  senescenceAgeSeconds: z.number().positive().default(80),
  maxAgeSeconds: z.number().positive().default(100),
  maxStemLength: z.number().positive().default(0.8),
  maxLeafArea: z.number().positive().default(1.2),
  maxFlowers: z.number().int().positive().default(4),
  pollinationRadiusMeters: z.number().positive().default(4),
  pollinationProbabilityPerSecond: z.number().min(0).max(1).default(0.5),
  selfPollinationProbabilityPerSecond: z.number().min(0).max(1).default(0.05),
  fruitFleshEnergy: z.number().positive().default(8),
  fruitRadius: z.number().positive().default(0.14),
  fruitLifespanSeconds: z.number().positive().default(20),
  fruitGerminationProbability: z.number().min(0).max(1).default(0.5),
  dispersalDelaySeconds: z.number().nonnegative().default(5),
  fruitScentRatePerSecond: z.number().nonnegative().default(1.5),
  plantScentRatePerSecond: z.number().nonnegative().default(0.4),
  scentField: z.string().min(1).default('scent.plant'),
  maxFruitsPerCycle: z.number().int().positive().default(2),
  plantColor: z.number().int().nonnegative().default(0x22c55e),
  flowerColor: z.number().int().nonnegative().default(0xf472b6),
  fruitColor: z.number().int().nonnegative().default(0xef4444),
  seedColor: z.number().int().nonnegative().default(0xa16207),
});

/**
 * Validated species configuration governing plant growth, pollination, fruiting, and dispersal.
 */
export type PlantSpeciesSpec = z.infer<typeof plantSpeciesSpecSchema>;

/**
 * Input shape accepted by {@link parsePlantSpeciesSpec} (fields with defaults are optional).
 */
export type PlantSpeciesInput = z.input<typeof plantSpeciesSpecSchema>;

/**
 * Parses and freezes a {@link PlantSpeciesSpec} using Zod defaults.
 */
export function parsePlantSpeciesSpec(input: PlantSpeciesInput): PlantSpeciesSpec {
  return Object.freeze(plantSpeciesSpecSchema.parse(input));
}

/**
 * ECS data for any plant entity (`kingdom: 'plant'`, no brain or spine).
 */
export interface PlantData {
  /** Taxonomic kingdom tag distinguishing plants from animals. */
  readonly kingdom: 'plant';
  /** Species identifier matching `spec.speciesId`. */
  readonly speciesId: string;
  /** Species parameters governing this plant. */
  readonly spec: PlantSpeciesSpec;
  /** Current lifecycle stage. */
  stage: PlantStage;
  /** Time spent in the current stage in seconds. */
  stageTimeSeconds: number;
  /** Growing physical organ dimensions (stem, leaf, flowers). */
  organs: PlantOrgans;
  /** Whether a flowering plant has been pollinated and can produce fruit. */
  pollinated: boolean;
  /** Number of fruits spawned during the current fruiting phase. */
  fruitsInCurrentCycle: number;
  /** Total fruits produced across the plant's lifetime. */
  totalFruitsProduced: number;
  /** Current physical/visual radius in meters synced to the collider. */
  currentRadius: number;
  /** Entity carrying this seed inside its gut during animal dispersal, or `null` when rooted. */
  carriedBy: EntityId | null;
  /** Remaining dispersal delay in seconds before excretion when `carriedBy !== null`. */
  dispersalRemainingSeconds: number;
  /** Last known world position of the carrier animal (used if carrier dies before excretion). */
  lastCarrierPos: Vec2 | null;
}

/**
 * ECS data for an independent fruit entity (`tags: ['fruit']`) holding edible flesh energy and
 * an internal seed for dispersal or germination (Section 5.9).
 */
export interface FruitData {
  /** Parent plant species identifier. */
  readonly speciesId: string;
  /** Parent plant species specification used when the internal seed sprouts or is dispersed. */
  readonly spec: PlantSpeciesSpec;
  /** Age of the fruit since detaching/spawning in seconds. */
  ageSeconds: number;
  /** Maximum lifespan before rotting/germinating in seconds. */
  readonly maxAgeSeconds: number;
  /** Energy reserved inside the internal seed (`EU`, mirrored in `EnergyComponent.structuralEnergy`). */
  readonly seedEnergy: number;
  /** Scent emission rate into `spec.scentField` per second. */
  readonly scentRatePerSecond: number;
  /** Probability in `[0, 1]` that an uneaten expired fruit's seed germinates. */
  readonly germinationProbability: number;
  /** Delay in seconds before an ingested seed is excreted by its eater. */
  readonly dispersalDelaySeconds: number;
  /** Last animal entity that bit/ate this fruit, used for endozoochorous seed dispersal. */
  eatenBy: EntityId | null;
}

/** ECS component marking a plant entity (`kingdom: 'plant'`) and storing its lifecycle state. */
export const PlantComponent = defineComponent<PlantData>('plant', 'Plant');

/** ECS component marking an independent fruit entity carrying edible flesh and an internal seed. */
export const FruitComponent = defineComponent<FruitData>('fruit', 'Fruit');
