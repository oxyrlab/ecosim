import { assertFiniteNumber, InvalidParameterError } from '@core/index';
import {
  CorpseComponent,
  EnergyComponent,
  HealthComponent,
  stepAgingSystem,
  stepDeathSystem,
  stepDecompositionSystem,
  stepHealthSystem,
  stepInteractionSystem,
  stepMetabolismSystem,
  type BiteResolution,
  type DeathRecord,
  type EnergyLedger,
} from '@life/index';
import {
  FruitComponent,
  PlantComponent,
  recordFruitBites,
  stepFruitSystem,
  stepPhotosynthesisSystem,
  stepPlantLifecycleSystem,
  stepPollinationSystem,
  stepSeedDispersalSystem,
  type FruitStepResult,
} from '@plants/index';
import { TransformComponent, type World } from '@world/index';
import { CreatureBrainComponent, stepNervousSystem } from './creature-runtime';

/**
 * Diagnostic summary returned by {@link stepEcosystemTick}.
 */
export interface EcosystemTickResult {
  readonly bites: readonly BiteResolution[];
  readonly fruits: FruitStepResult;
  readonly deaths: readonly DeathRecord[];
}

/**
 * Executes one complete deterministic ecosystem simulation tick combining nervous systems,
 * predation/feeding, photosynthesis, aging, metabolism, plant lifecycle, pollination, fruiting,
 * seed dispersal, health, death, decomposition, field diffusion, and rigid-body physics.
 *
 * @param world - Simulation world.
 * @param dt - Positive fixed timestep in seconds (e.g. `1/30`).
 * @param ledger - Optional {@link EnergyLedger} for conservation auditing.
 * @param diffusionIntervalTicks - Run `world.fields.stepDiffusion()` every N ticks (default `3`).
 */
export function stepEcosystemTick(
  world: World,
  dt: number,
  ledger?: EnergyLedger,
  diffusionIntervalTicks = 3,
): EcosystemTickResult {
  assertFiniteNumber('dt', dt, 'stepEcosystemTick');
  if (dt <= 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number > 0', 'stepEcosystemTick');
  }

  const actions = stepNervousSystem(world, dt);
  const bites = stepInteractionSystem(world, actions, ledger);
  recordFruitBites(world, bites);

  stepPhotosynthesisSystem(world, dt, ledger);
  stepAgingSystem(world, dt);
  stepMetabolismSystem(world, dt, ledger);
  stepPlantLifecycleSystem(world, dt);
  stepPollinationSystem(world, dt);
  const fruits = stepFruitSystem(world, dt, ledger);
  stepSeedDispersalSystem(world, dt);
  stepHealthSystem(world, dt);
  const deaths = stepDeathSystem(world, ledger);
  stepDecompositionSystem(world, dt, ledger);

  world.tick += 1;
  world.timeSeconds += dt;
  if (diffusionIntervalTicks > 0 && world.tick % diffusionIntervalTicks === 0) {
    world.fields.stepDiffusion();
  }

  world.physics.step(dt);
  world.syncFromPhysics();

  return { bites, fruits, deaths };
}

/**
 * Computes a deterministic 32-bit FNV-1a state hash across entity transforms, energies, health,
 * plants, corpses, and grid field totals for bit-exact determinism verification (Section 9.5).
 */
export function computeWorldStateHash(world: World): number {
  let hash = 0x811c9dc5;
  const mix = (n: number): void => {
    const quantized = Math.round(n * 1e4) | 0;
    hash ^= quantized;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };

  mix(world.tick);
  for (const entity of world.ecs.query(TransformComponent)) {
    const t = world.ecs.requireComponent(entity, TransformComponent);
    mix(entity);
    mix(t.x);
    mix(t.y);
    mix(t.angle);
  }
  for (const entity of world.ecs.query(EnergyComponent)) {
    const e = world.ecs.requireComponent(entity, EnergyComponent);
    mix(entity);
    mix(e.current);
  }
  for (const entity of world.ecs.query(HealthComponent)) {
    const h = world.ecs.requireComponent(entity, HealthComponent);
    mix(entity);
    mix(h.current);
  }
  for (const entity of world.ecs.query(PlantComponent)) {
    const p = world.ecs.requireComponent(entity, PlantComponent);
    mix(entity);
    mix(p.organs.leafArea);
  }
  for (const entity of world.ecs.query(FruitComponent)) {
    const f = world.ecs.requireComponent(entity, FruitComponent);
    mix(entity);
    mix(f.ageSeconds);
  }
  for (const entity of world.ecs.query(CorpseComponent)) {
    const c = world.ecs.requireComponent(entity, CorpseComponent);
    mix(entity);
    mix(c.energy);
  }
  for (const entity of world.ecs.query(CreatureBrainComponent)) {
    const b = world.ecs.requireComponent(entity, CreatureBrainComponent);
    for (let i = 0; i < b.bus.channelCount; i += 1) {
      mix(b.bus.readIndex(i));
    }
  }
  for (const name of world.fields.names()) {
    mix(world.fields.get(name).totalMass());
  }

  return hash >>> 0;
}
