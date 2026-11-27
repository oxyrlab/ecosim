import { InvalidParameterError } from '@core/index';
import { ReproductionComponent } from '@genome/index';
import { computeWorldEnergy, CorpseComponent, type EnergyLedger } from '@life/index';
import { FruitComponent, PlantComponent } from '@plants/index';
import { CreatureBrainComponent } from '@species/index';
import { TransformComponent, type World } from '@world/index';

/**
 * Time-stamped population and energy telemetry sample emitted by {@link Simulation}.
 */
export interface SimulationStatsSnapshot {
  readonly tick: number;
  readonly timeSeconds: number;
  readonly totalEntities: number;
  readonly animalCount: number;
  readonly plantCount: number;
  readonly fruitCount: number;
  readonly corpseCount: number;
  readonly speciesCounts: Readonly<Record<string, number>>;
  readonly totalWorldEnergy: number;
  readonly energyDiscrepancy: number;
  readonly energyBalanced: boolean;
  readonly cumulativeBirths: number;
  readonly cumulativeDeaths: number;
}

/**
 * Aggregated evolutionary lineage summary per animal species for headless experiment reports.
 */
export interface SpeciesGenomeSummary {
  readonly speciesId: string;
  readonly population: number;
  readonly maxGeneration: number;
  readonly averageGeneration: number;
  readonly totalOffspring: number;
}

/**
 * Collects a live {@link SimulationStatsSnapshot} from `world` and its {@link EnergyLedger}.
 */
export function collectSimulationStats(
  world: World,
  ledger: EnergyLedger,
  cumulativeBirths: number,
  cumulativeDeaths: number,
): SimulationStatsSnapshot {
  const speciesCounts: Record<string, number> = {};
  const incSpecies = (id: string): void => {
    speciesCounts[id] = (speciesCounts[id] ?? 0) + 1;
  };

  const animals = world.ecs.query(CreatureBrainComponent);
  for (const entity of animals) {
    incSpecies(world.ecs.requireComponent(entity, CreatureBrainComponent).speciesId);
  }

  const plants = world.ecs.query(PlantComponent);
  for (const entity of plants) {
    incSpecies(world.ecs.requireComponent(entity, PlantComponent).speciesId);
  }

  const fruits = world.ecs.query(FruitComponent);
  const corpses = world.ecs.query(CorpseComponent);
  const totalEntities = world.ecs.query(TransformComponent).length;

  const totalWorldEnergy = computeWorldEnergy(world);
  const audit = ledger.audit(totalWorldEnergy, 1e-1);

  return {
    tick: world.tick,
    timeSeconds: world.timeSeconds,
    totalEntities,
    animalCount: animals.length,
    plantCount: plants.length,
    fruitCount: fruits.length,
    corpseCount: corpses.length,
    speciesCounts,
    totalWorldEnergy,
    energyDiscrepancy: audit.discrepancy,
    energyBalanced: audit.balanced,
    cumulativeBirths,
    cumulativeDeaths,
  };
}

/**
 * Summarizes generation and reproduction counts across all living reproducing animals in `world`.
 */
export function collectGenomeSummary(world: World): readonly SpeciesGenomeSummary[] {
  const buckets = new Map<
    string,
    { count: number; maxGen: number; sumGen: number; offspring: number }
  >();

  for (const entity of world.ecs.query(ReproductionComponent)) {
    const repro = world.ecs.requireComponent(entity, ReproductionComponent);
    const entry = buckets.get(repro.speciesId) ?? {
      count: 0,
      maxGen: 0,
      sumGen: 0,
      offspring: 0,
    };
    entry.count += 1;
    if (repro.generation > entry.maxGen) entry.maxGen = repro.generation;
    entry.sumGen += repro.generation;
    entry.offspring += repro.offspringCount;
    buckets.set(repro.speciesId, entry);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([speciesId, stats]) => ({
      speciesId,
      population: stats.count,
      maxGeneration: stats.maxGen,
      averageGeneration: stats.count > 0 ? stats.sumGen / stats.count : 0,
      totalOffspring: stats.offspring,
    }));
}

/**
 * Bounded FIFO ring buffer storing historical {@link SimulationStatsSnapshot} samples for
 * live population charts and headless CSV/JSON exports.
 */
export class StatsHistory {
  private readonly samples: SimulationStatsSnapshot[] = [];
  private readonly maxSamples: number;

  /**
   * Creates a {@link StatsHistory} retaining at most `maxSamples` recent entries.
   */
  public constructor(maxSamples = 600) {
    if (!Number.isInteger(maxSamples) || maxSamples < 1) {
      throw new InvalidParameterError('maxSamples', maxSamples, 'an integer >= 1', 'StatsHistory');
    }
    this.maxSamples = maxSamples;
  }

  /** Number of retained telemetry samples. */
  public get length(): number {
    return this.samples.length;
  }

  /** Appends a sample, evicting the oldest entry if capacity is exceeded. */
  public record(sample: SimulationStatsSnapshot): void {
    if (this.samples.length >= this.maxSamples) {
      this.samples.shift();
    }
    this.samples.push(sample);
  }

  /** Returns all retained samples in chronological order. */
  public getSamples(): readonly SimulationStatsSnapshot[] {
    return this.samples;
  }

  /** Clears all retained samples. */
  public clear(): void {
    this.samples.length = 0;
  }
}

/**
 * Converts a sequence of {@link SimulationStatsSnapshot} samples into a deterministic CSV string.
 */
export function statsHistoryToCsv(
  samples: readonly SimulationStatsSnapshot[],
  explicitSpeciesIds?: readonly string[],
): string {
  const speciesSet = new Set<string>(explicitSpeciesIds ?? []);
  for (const sample of samples) {
    for (const id of Object.keys(sample.speciesCounts)) {
      speciesSet.add(id);
    }
  }
  const speciesIds = Array.from(speciesSet).sort();

  const header = [
    'tick',
    'timeSeconds',
    'totalEntities',
    'animalCount',
    'plantCount',
    'fruitCount',
    'corpseCount',
    'totalWorldEnergy',
    'energyDiscrepancy',
    'cumulativeBirths',
    'cumulativeDeaths',
    ...speciesIds.map((id) => `species:${id}`),
  ];

  const rows = [header.join(',')];
  for (const s of samples) {
    rows.push(
      [
        s.tick,
        s.timeSeconds.toFixed(4),
        s.totalEntities,
        s.animalCount,
        s.plantCount,
        s.fruitCount,
        s.corpseCount,
        s.totalWorldEnergy.toFixed(4),
        s.energyDiscrepancy.toFixed(4),
        s.cumulativeBirths,
        s.cumulativeDeaths,
        ...speciesIds.map((id) => s.speciesCounts[id] ?? 0),
      ].join(','),
    );
  }

  return rows.join('\n');
}
