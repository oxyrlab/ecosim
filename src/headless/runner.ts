import { InvalidParameterError } from '@core/index';
import type { EnergyAuditResult } from '@life/index';
import { createRapierPhysicsAdapter } from '@physics/index';
import {
  getBuiltinScenario,
  Simulation,
  statsHistoryToCsv,
  type ScenarioConfig,
  type SimulationStatsSnapshot,
  type SpeciesGenomeSummary,
} from '@sim/index';

/**
 * Supported export formats for the headless CLI runner.
 */
export type HeadlessOutputFormat = 'json' | 'csv';

/**
 * Parsed command-line arguments accepted by `src/headless/run.ts`.
 */
export interface ParsedHeadlessArgs {
  readonly seed: number;
  readonly ticks: number;
  readonly scenario: string;
  readonly outPath: string | null;
  readonly format: HeadlessOutputFormat;
  readonly sampleIntervalTicks: number;
  readonly help: boolean;
}

/**
 * Programmatic configuration for {@link runHeadlessSimulation}.
 */
export interface HeadlessRunOptions {
  /** Number of fixed simulation ticks to execute (integer >= 0). */
  readonly ticks: number;
  /** Optional integer RNG seed overriding the scenario's world seed. */
  readonly seed?: number;
  /** Explicit {@link ScenarioConfig} to execute (overrides `scenarioName`). */
  readonly scenario?: ScenarioConfig;
  /** Built-in scenario preset name when `scenario` is omitted (default `'default'`). */
  readonly scenarioName?: string;
  /** Fixed ticks between telemetry samples (default `30` = 1s at 30 Hz). */
  readonly sampleIntervalTicks?: number;
}

/**
 * Deterministic experiment report returned by {@link runHeadlessSimulation}.
 */
export interface HeadlessRunResult {
  readonly seed: number;
  readonly scenarioName: string;
  readonly ticksExecuted: number;
  readonly finalTick: number;
  readonly finalTimeSeconds: number;
  readonly finalStateHash: number;
  readonly energyAudit: EnergyAuditResult;
  readonly finalStats: SimulationStatsSnapshot;
  readonly statsHistory: readonly SimulationStatsSnapshot[];
  readonly genomeSummary: readonly SpeciesGenomeSummary[];
  readonly commandCount: number;
}

function parseIntArg(flag: string, raw: string | undefined, minValue: number): number {
  if (raw === undefined || !/^-?\d+$/.test(raw)) {
    throw new InvalidParameterError(flag, raw, `an integer >= ${minValue}`, 'parseHeadlessArgs');
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < minValue) {
    throw new InvalidParameterError(flag, value, `an integer >= ${minValue}`, 'parseHeadlessArgs');
  }
  return value;
}

/**
 * Parses CLI flags (`--seed`, `--ticks`, `--scenario`, `--out`, `--format`, `--sample-interval`,
 * `--help`) into a strongly typed {@link ParsedHeadlessArgs} object.
 */
export function parseHeadlessArgs(argv: readonly string[]): ParsedHeadlessArgs {
  let seed = 42;
  let ticks = 300;
  let scenario = 'default';
  let outPath: string | null = null;
  let format: HeadlessOutputFormat | null = null;
  let sampleIntervalTicks = 30;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--seed') {
      seed = parseIntArg('--seed', argv[i + 1], -2147483648);
      i += 1;
    } else if (arg === '--ticks') {
      ticks = parseIntArg('--ticks', argv[i + 1], 0);
      i += 1;
    } else if (arg === '--scenario') {
      const value = argv[i + 1];
      if (value === undefined || value.trim() === '') {
        throw new InvalidParameterError(
          '--scenario',
          value,
          'a scenario preset name or JSON file path',
          'parseHeadlessArgs',
        );
      }
      scenario = value;
      i += 1;
    } else if (arg === '--out') {
      const value = argv[i + 1];
      if (value === undefined || value.trim() === '') {
        throw new InvalidParameterError('--out', value, 'a file path', 'parseHeadlessArgs');
      }
      outPath = value;
      i += 1;
    } else if (arg === '--format') {
      const value = argv[i + 1];
      if (value !== 'json' && value !== 'csv') {
        throw new InvalidParameterError('--format', value, "'json' or 'csv'", 'parseHeadlessArgs');
      }
      format = value;
      i += 1;
    } else if (arg === '--sample-interval') {
      sampleIntervalTicks = parseIntArg('--sample-interval', argv[i + 1], 1);
      i += 1;
    } else {
      throw new InvalidParameterError(
        'arg',
        arg,
        'a recognized flag (--seed, --ticks, --scenario, --out, --format, --sample-interval, --help)',
        'parseHeadlessArgs',
      );
    }
  }

  const inferredFormat: HeadlessOutputFormat =
    format ?? (outPath !== null && outPath.toLowerCase().endsWith('.csv') ? 'csv' : 'json');

  return {
    seed,
    ticks,
    scenario,
    outPath,
    format: inferredFormat,
    sampleIntervalTicks,
    help,
  };
}

/**
 * Executes a deterministic headless EcoSim experiment using real Rapier 2D WASM physics and
 * returns population time series, `EnergyLedger` audit, birth/death counts, and genome summaries.
 */
export async function runHeadlessSimulation(
  options: HeadlessRunOptions,
): Promise<HeadlessRunResult> {
  if (!Number.isInteger(options.ticks) || options.ticks < 0) {
    throw new InvalidParameterError(
      'ticks',
      options.ticks,
      'an integer >= 0',
      'runHeadlessSimulation',
    );
  }
  const sampleInterval = options.sampleIntervalTicks ?? 30;
  if (!Number.isInteger(sampleInterval) || sampleInterval < 1) {
    throw new InvalidParameterError(
      'sampleIntervalTicks',
      sampleInterval,
      'an integer >= 1',
      'runHeadlessSimulation',
    );
  }

  const baseScenario =
    options.scenario ?? getBuiltinScenario(options.scenarioName ?? 'default', options.seed ?? 42);
  const effectiveSeed = options.seed ?? baseScenario.world.seed;
  const effectiveScenario: ScenarioConfig =
    effectiveSeed === baseScenario.world.seed
      ? baseScenario
      : {
          ...baseScenario,
          world: { ...baseScenario.world, seed: effectiveSeed },
        };

  const physics = await createRapierPhysicsAdapter();
  const maxStatsSamples = Math.max(2, Math.ceil(options.ticks / sampleInterval) + 2);
  const sim = new Simulation(
    {
      world: effectiveScenario.world,
      scenario: effectiveScenario,
      statsIntervalTicks: sampleInterval,
      maxStatsSamples,
    },
    physics,
  );

  try {
    for (let i = 0; i < options.ticks; i += 1) {
      sim.stepFixed();
    }

    const finalStats = sim.getStats();
    const energyAudit = sim.ledger.audit(finalStats.totalWorldEnergy, 1e-1);
    const history = [...sim.getStatsHistory()];
    if (history[history.length - 1]?.tick !== finalStats.tick) {
      history.push(finalStats);
    }

    return {
      seed: effectiveSeed,
      scenarioName: effectiveScenario.name,
      ticksExecuted: options.ticks,
      finalTick: sim.world.tick,
      finalTimeSeconds: sim.world.timeSeconds,
      finalStateHash: sim.computeStateHash(),
      energyAudit,
      finalStats,
      statsHistory: history,
      genomeSummary: sim.getGenomeSummary(),
      commandCount: sim.getCommandHistory().length,
    };
  } finally {
    sim.free();
  }
}

/**
 * Formats a {@link HeadlessRunResult} as either formatted JSON or population time-series CSV.
 */
export function formatHeadlessOutput(
  result: HeadlessRunResult,
  format: HeadlessOutputFormat,
): string {
  if (format === 'csv') {
    return statsHistoryToCsv(result.statsHistory);
  }
  return JSON.stringify(result, null, 2);
}
