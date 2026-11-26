import { parsePlantSpeciesSpec } from '@plants/components';
import { defineSpecies, type PlantSpeciesBlueprint } from './blueprint';

/**
 * Built-in fruiting berry bush species (`kingdom: 'plant'`).
 * Produces high-energy berries dispersed by foraging herbivores.
 */
export const BERRY_BUSH_BLUEPRINT: PlantSpeciesBlueprint = defineSpecies({
  id: 'berry-bush',
  name: 'Berry Bush',
  description: 'Woody flowering shrub producing nutrient-rich berries dispersed by herbivores.',
  kingdom: 'plant',
  tags: ['plant', 'berry-bush'],
  plantSpec: parsePlantSpeciesSpec({
    speciesId: 'berry-bush',
    seedRadius: 0.08,
    adultRadius: 0.48,
    maxEnergy: 70,
    seedEnergy: 4,
    structuralEnergy: 6,
    basalRatePerKgPerSecond: 0.04,
    massKg: 1.2,
    photosynthesisRatePerArea: 9,
    nutrientFraction: 0.25,
    germinationDelaySeconds: 2.5,
    crowdingRadiusMeters: 1.0,
    maxNeighborsToGerminate: 2,
    sproutToMatureAgeSeconds: 7,
    sproutToMatureEnergy: 16,
    matureToFloweringAgeSeconds: 12,
    matureToFloweringEnergy: 28,
    senescenceAgeSeconds: 110,
    maxAgeSeconds: 140,
    maxStemLength: 0.9,
    maxLeafArea: 1.4,
    maxFlowers: 5,
    pollinationRadiusMeters: 5,
    pollinationProbabilityPerSecond: 0.65,
    selfPollinationProbabilityPerSecond: 0.08,
    fruitFleshEnergy: 10,
    fruitRadius: 0.14,
    fruitLifespanSeconds: 20,
    fruitGerminationProbability: 0.55,
    dispersalDelaySeconds: 6,
    fruitScentRatePerSecond: 2.0,
    plantScentRatePerSecond: 0.6,
    maxFruitsPerCycle: 2,
    plantColor: 0x16a34a,
    flowerColor: 0xf9a8d4,
    fruitColor: 0xe11d48,
    seedColor: 0x78350f,
  }),
});
