import { parsePlantSpeciesSpec } from '@plants/components';
import { defineSpecies, type PlantSpeciesBlueprint } from './blueprint';

/**
 * Built-in fast-growing self-pollinating grass species (`kingdom: 'plant'`).
 * Forms the primary producer base layer for herbivores such as `rabbit`.
 */
export const GRASS_BLUEPRINT: PlantSpeciesBlueprint = defineSpecies({
  id: 'grass',
  name: 'Meadow Grass',
  description: 'Fast-growing self-pollinating ground cover providing steady energy for herbivores.',
  kingdom: 'plant',
  tags: ['plant', 'grass'],
  plantSpec: parsePlantSpeciesSpec({
    speciesId: 'grass',
    seedRadius: 0.06,
    adultRadius: 0.28,
    maxEnergy: 35,
    seedEnergy: 3,
    structuralEnergy: 3,
    basalRatePerKgPerSecond: 0.03,
    massKg: 0.4,
    photosynthesisRatePerArea: 8,
    nutrientFraction: 0.2,
    germinationDelaySeconds: 2.5,
    crowdingRadiusMeters: 2.2,
    maxNeighborsToGerminate: 2,
    sproutToMatureAgeSeconds: 6,
    sproutToMatureEnergy: 10,
    matureToFloweringAgeSeconds: 20,
    matureToFloweringEnergy: 20,
    senescenceAgeSeconds: 190,
    maxAgeSeconds: 240,
    maxStemLength: 0.3,
    maxLeafArea: 0.8,
    maxFlowers: 2,
    pollinationRadiusMeters: 2.5,
    pollinationProbabilityPerSecond: 0.4,
    selfPollinationProbabilityPerSecond: 0.15,
    fruitFleshEnergy: 3,
    fruitRadius: 0.09,
    fruitLifespanSeconds: 8,
    fruitGerminationProbability: 0.45,
    dispersalDelaySeconds: 3,
    fruitScentRatePerSecond: 0.6,
    plantScentRatePerSecond: 0.5,
    maxFruitsPerCycle: 1,
    plantColor: 0x4ade80,
    flowerColor: 0xbef264,
    fruitColor: 0xa3e635,
    seedColor: 0x854d0e,
  }),
});
