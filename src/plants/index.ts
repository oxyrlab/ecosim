export {
  FruitComponent,
  parsePlantSpeciesSpec,
  PlantComponent,
  plantSpeciesSpecSchema,
  type FruitData,
  type PlantData,
  type PlantOrgans,
  type PlantSpeciesInput,
  type PlantSpeciesSpec,
  type PlantStage,
} from './components';
export { stepSeedDispersalSystem } from './dispersal';
export { recordFruitBites, stepFruitSystem, type FruitStepResult } from './fruit';
export { stepPlantLifecycleSystem } from './lifecycle';
export { stepPhotosynthesisSystem } from './photosynthesis';
export { stepPollinationSystem } from './pollination';
export {
  computeInitialPlantMorphology,
  computePlantRenderKind,
  spawnFruit,
  spawnPlant,
  syncPlantVisualsAndTags,
  type SpawnPlantOptions,
} from './spawn';
