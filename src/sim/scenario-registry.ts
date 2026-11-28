import { InvalidParameterError } from '@core/index';
import {
  createDefaultMeadowScenario,
  createEmptySandboxScenario,
  createRabbitForagingScenario,
  createRabbitReproductionScenario,
  createRabbitStarvationScenario,
  type ScenarioConfig,
} from './scenario';

/**
 * Functional category of a registered {@link ScenarioPreset} shown in the UI selector and
 * ecological benchmark suite.
 */
export type ScenarioCategory = 'ecosystem' | 'benchmark' | 'sandbox';

/**
 * Quantitative ecological validation criteria attached to a benchmark scenario, anchored to real
 * biological reference data (e.g. Oryctolagus cuniculus fasting survival).
 */
export interface EcologicalBenchmarkSpec {
  /** Human-readable biological reference source and expected real-world range. */
  readonly referenceSource: string;
  /** Explicit ecological time-scale mapping (e.g. `'10 sim s = 1 ecological day'`). */
  readonly timeScaleLabel: string;
  /** Total simulation duration in seconds to evaluate. */
  readonly durationSeconds: number;
  /** Target species ID tracked for survival, cause of death, and locomotion kinematics. */
  readonly targetSpeciesId: string;
  /** Expected final mortality fraction in `[0, 1]` (e.g. `[1, 1]` for total starvation). */
  readonly expectedMortalityRange?: readonly [min: number, max: number];
  /** Minimum fraction of deaths that must be caused by `'starvation'` in `[0, 1]`. */
  readonly minStarvationCauseFraction?: number;
  /** Expected median survival time (`LT50`) in seconds with ideal reference target. */
  readonly expectedLt50Seconds?: {
    readonly min: number;
    readonly max: number;
    readonly ideal: number;
  };
  /** Minimum spread between first and last death in seconds (prevents simultaneous step wipeouts). */
  readonly minDeathSpreadSeconds?: number;
  /** Maximum acceptable mean angular speed `|omega|` in degrees/second (prevents rapid spinning). */
  readonly maxMeanAngularSpeedDegPerSec: number;
  /** Expected mean locomotion speed range in `m/s`. */
  readonly expectedMeanSpeedRange?: readonly [min: number, max: number];
}

/**
 * Registered scenario preset usable both from the interactive Observation UI dropdown and from
 * automated headless benchmark/test runners.
 */
export interface ScenarioPreset {
  readonly id: string;
  readonly label: string;
  readonly category: ScenarioCategory;
  readonly description: string;
  readonly create: (seed?: number) => ScenarioConfig;
  readonly benchmark?: EcologicalBenchmarkSpec;
}

/**
 * Lightweight UI-safe descriptor of a {@link ScenarioPreset} for dropdown rendering.
 */
export interface ScenarioPresetSummary {
  readonly id: string;
  readonly label: string;
  readonly category: ScenarioCategory;
  readonly description: string;
  readonly hasBenchmark: boolean;
}

/**
 * Canonical ordered list of built-in EcoSim scenarios shared between the UI dropdown and headless
 * ecological benchmark suite.
 */
export const SCENARIO_PRESETS: readonly ScenarioPreset[] = Object.freeze([
  {
    id: 'default-meadow',
    label: 'Default Meadow — Balanced Ecosystem',
    category: 'ecosystem',
    description:
      'Balanced 40x40m meadow with grass, berry bushes, rabbits (4♀, 3♂), and foxes (1♀, 1♂).',
    create: createDefaultMeadowScenario,
  },
  {
    id: 'rabbit-starvation-5',
    label: 'Benchmark: 5 Rabbits (3♀, 2♂) — No Plants',
    category: 'benchmark',
    description:
      '5 rabbits (3 female, 2 male) in a barren 40x40m arena with zero plants to validate starvation dynamics and natural movement.',
    create: createRabbitStarvationScenario,
    benchmark: {
      referenceSource: 'Oryctolagus cuniculus total fasting survival: 7–12 days (mean ~9 days)',
      timeScaleLabel: '10 sim s = 1 ecological day',
      durationSeconds: 180,
      targetSpeciesId: 'rabbit',
      expectedMortalityRange: [1, 1],
      minStarvationCauseFraction: 1,
      expectedLt50Seconds: { min: 65, max: 125, ideal: 90 },
      minDeathSpreadSeconds: 5,
      maxMeanAngularSpeedDegPerSec: 180,
      expectedMeanSpeedRange: [0.25, 3.5],
    },
  },
  {
    id: 'rabbit-foraging-5',
    label: 'Benchmark: 5 Rabbits (3♀, 2♂) — Grass Meadow',
    category: 'benchmark',
    description:
      'Control scenario: 5 rabbits (3 female, 2 male) in a grass meadow verifying foraging sustains life.',
    create: createRabbitForagingScenario,
    benchmark: {
      referenceSource: 'Oryctolagus cuniculus foraging survival in abundant meadow (high survival)',
      timeScaleLabel: '10 sim s = 1 ecological day',
      durationSeconds: 150,
      targetSpeciesId: 'rabbit',
      expectedMortalityRange: [0, 0.2],
      maxMeanAngularSpeedDegPerSec: 180,
      expectedMeanSpeedRange: [0.2, 3.8],
    },
  },
  {
    id: 'rabbit-reproduction-5',
    label: 'Observation: Rabbit Reproduction & Growth (3♀, 2♂)',
    category: 'ecosystem',
    description:
      '5 well-fed rabbits (3 female, 2 male) in a lush 16x16m grass glade to observe sexual reproduction and newborn growth.',
    create: createRabbitReproductionScenario,
  },
  {
    id: 'empty-sandbox',
    label: 'Blank Sandbox Arena',
    category: 'sandbox',
    description: 'Empty fertile 40x40m arena ready for manual spawning and field painting.',
    create: createEmptySandboxScenario,
  },
]);

const presetById = new Map<string, ScenarioPreset>(SCENARIO_PRESETS.map((p) => [p.id, p]));

/**
 * Lists all built-in scenario presets as lightweight dropdown descriptors.
 */
export function listScenarioPresets(): readonly ScenarioPresetSummary[] {
  return SCENARIO_PRESETS.map((p) => ({
    id: p.id,
    label: p.label,
    category: p.category,
    description: p.description,
    hasBenchmark: p.benchmark !== undefined,
  }));
}

/**
 * Resolves a registered {@link ScenarioPreset} by exact `id`.
 */
export function getScenarioPreset(id: string): ScenarioPreset {
  const found = presetById.get(id);
  if (found === undefined) {
    throw new InvalidParameterError(
      'scenarioId',
      id,
      `one of [${SCENARIO_PRESETS.map((p) => `'${p.id}'`).join(', ')}]`,
      'getScenarioPreset',
    );
  }
  return found;
}

/**
 * Returns all built-in {@link ScenarioPreset}s that declare quantitative ecological benchmarks.
 */
export function listBenchmarkPresets(): readonly ScenarioPreset[] {
  return SCENARIO_PRESETS.filter((p) => p.benchmark !== undefined);
}
