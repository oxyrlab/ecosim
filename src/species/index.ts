import { BERRY_BUSH_BLUEPRINT } from './berry-bush';
import { registerSpecies } from './blueprint';
import { FOX_BLUEPRINT } from './fox/blueprint';
import { GRASS_BLUEPRINT } from './grass';
import { RABBIT_BLUEPRINT } from './rabbit/blueprint';

/**
 * All built-in Phase 5 species automatically registered into {@link speciesRegistry}.
 */
export const BUILTIN_SPECIES = [
  GRASS_BLUEPRINT,
  BERRY_BUSH_BLUEPRINT,
  RABBIT_BLUEPRINT,
  FOX_BLUEPRINT,
] as const;

for (const species of BUILTIN_SPECIES) {
  registerSpecies(species);
}

export { BERRY_BUSH_BLUEPRINT } from './berry-bush';
export {
  defineSpecies,
  registerSpecies,
  speciesBlueprintSchema,
  speciesRegistry,
  type AnimalDietSpec,
  type AnimalLifecycleSpec,
  type AnimalMetabolismSpec,
  type AnimalScentSpec,
  type AnimalSpeciesBlueprint,
  type BrainModuleInstanceSpec,
  type PlantSpeciesBlueprint,
  type SpeciesBlueprint,
  type SpineInstanceSpec,
} from './blueprint';
export {
  CreatureBrainComponent,
  stepNervousSystem,
  type CreatureBrainData,
  type MountedActuatorRuntime,
  type MountedSensorRuntime,
} from './creature-runtime';
export {
  computeWorldStateHash,
  stepEcosystemTick,
  type EcosystemTickResult,
} from './ecosystem-step';
export {
  spawnSpeciesEntity,
  validateAnimalBlueprint,
  type SpawnSpeciesOptions,
  type ValidatedAnimalBlueprint,
} from './entity-factory';
export { FOX_BLUEPRINT } from './fox/blueprint';
export {
  foxHuntPreyModule,
  foxHuntPreyParamsSchema,
  type FoxHuntPreyParams,
} from './fox/hunt-prey';
export { GRASS_BLUEPRINT } from './grass';
export { RABBIT_BLUEPRINT } from './rabbit/blueprint';
export {
  rabbitFleePredatorModule,
  rabbitFleePredatorParamsSchema,
  type RabbitFleePredatorParams,
} from './rabbit/flee-predator';
