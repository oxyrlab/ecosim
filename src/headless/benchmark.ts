import { SIMULATION_DEFAULTS } from '@config/index';
import type { EntityId } from '@core/index';
import { computeWorldEnergy, type DeathCause } from '@life/index';
import { createRapierPhysicsAdapter, type PhysicsAdapter } from '@physics/index';
import { Simulation, type EcologicalBenchmarkSpec, type ScenarioPreset } from '@sim/index';
import { CreatureBrainComponent } from '@species/index';
import { PhysicsBodyComponent } from '@world/index';

/**
 * Individual pass/fail assertion evaluated against real biological or kinematic criteria.
 */
export interface BenchmarkCheckResult {
  readonly metric: string;
  readonly actual: string;
  readonly target: string;
  readonly deviationPercent: number | null;
  readonly passed: boolean;
}

/**
 * Recorded death event for one tracked target-species individual during a benchmark run.
 */
export interface TrackedDeathEvent {
  readonly entityId: EntityId;
  readonly timeSeconds: number;
  readonly cause: DeathCause;
}

/**
 * Structured output returned by {@link runScenarioBenchmark}.
 */
export interface ScenarioBenchmarkResult {
  readonly scenarioId: string;
  readonly label: string;
  readonly seed: number;
  readonly referenceSource: string;
  readonly timeScaleLabel: string;
  readonly durationSeconds: number;
  readonly wallTimeMs: number;
  readonly initialCount: number;
  readonly finalAliveCount: number;
  readonly mortalityFraction: number;
  readonly deaths: readonly TrackedDeathEvent[];
  readonly deathCauses: Readonly<Record<string, number>>;
  readonly lt10Seconds: number | null;
  readonly lt50Seconds: number | null;
  readonly lt90Seconds: number | null;
  readonly firstDeathSeconds: number | null;
  readonly lastDeathSeconds: number | null;
  readonly deathSpreadSeconds: number;
  readonly meanSpeedMetersPerSec: number;
  readonly meanAngularSpeedDegPerSec: number;
  readonly peakAngularSpeedDegPerSec: number;
  readonly energyBalanced: boolean;
  readonly energyDiscrepancy: number;
  readonly checks: readonly BenchmarkCheckResult[];
  readonly passed: boolean;
}

function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0] ?? null;
  const idx = Math.max(0, Math.min(sorted.length - 1, p * (sorted.length - 1)));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  const vLo = sorted[lo] ?? 0;
  const vHi = sorted[hi] ?? vLo;
  return vLo + (vHi - vLo) * frac;
}

function evaluateBenchmarkChecks(
  spec: EcologicalBenchmarkSpec,
  metrics: {
    readonly mortalityFraction: number;
    readonly starvationCauseFraction: number;
    readonly deathCount: number;
    readonly lt50Seconds: number | null;
    readonly deathSpreadSeconds: number;
    readonly meanSpeedMetersPerSec: number;
    readonly meanAngularSpeedDegPerSec: number;
    readonly energyBalanced: boolean;
    readonly energyDiscrepancy: number;
  },
): BenchmarkCheckResult[] {
  const checks: BenchmarkCheckResult[] = [];

  if (spec.expectedMortalityRange !== undefined) {
    const [minM, maxM] = spec.expectedMortalityRange;
    checks.push({
      metric: 'Mortality fraction',
      actual: `${(metrics.mortalityFraction * 100).toFixed(0)}%`,
      target: `${(minM * 100).toFixed(0)}%–${(maxM * 100).toFixed(0)}%`,
      deviationPercent: null,
      passed: metrics.mortalityFraction >= minM - 1e-9 && metrics.mortalityFraction <= maxM + 1e-9,
    });
  }

  if (spec.minStarvationCauseFraction !== undefined) {
    const passed =
      metrics.deathCount > 0 &&
      metrics.starvationCauseFraction >= spec.minStarvationCauseFraction - 1e-9;
    checks.push({
      metric: 'Starvation cause share',
      actual: `${(metrics.starvationCauseFraction * 100).toFixed(0)}%`,
      target: `>= ${(spec.minStarvationCauseFraction * 100).toFixed(0)}%`,
      deviationPercent: null,
      passed,
    });
  }

  if (spec.expectedLt50Seconds !== undefined) {
    const { min, max, ideal } = spec.expectedLt50Seconds;
    const lt50 = metrics.lt50Seconds;
    const deviationPercent = lt50 !== null && ideal > 0 ? ((lt50 - ideal) / ideal) * 100 : null;
    checks.push({
      metric: 'Median survival LT50',
      actual: lt50 !== null ? `${lt50.toFixed(1)}s` : 'N/A',
      target: `${min}–${max}s (ideal ${ideal}s)`,
      deviationPercent,
      passed: lt50 !== null && lt50 >= min && lt50 <= max,
    });
  }

  if (spec.minDeathSpreadSeconds !== undefined) {
    checks.push({
      metric: 'Death time spread',
      actual: `${metrics.deathSpreadSeconds.toFixed(1)}s`,
      target: `>= ${spec.minDeathSpreadSeconds}s`,
      deviationPercent: null,
      passed: metrics.deathSpreadSeconds >= spec.minDeathSpreadSeconds,
    });
  }

  checks.push({
    metric: 'Mean angular speed |ω|',
    actual: `${metrics.meanAngularSpeedDegPerSec.toFixed(1)} deg/s`,
    target: `<= ${spec.maxMeanAngularSpeedDegPerSec} deg/s`,
    deviationPercent: null,
    passed: metrics.meanAngularSpeedDegPerSec <= spec.maxMeanAngularSpeedDegPerSec,
  });

  if (spec.expectedMeanSpeedRange !== undefined) {
    const [minS, maxS] = spec.expectedMeanSpeedRange;
    checks.push({
      metric: 'Mean cruising speed',
      actual: `${metrics.meanSpeedMetersPerSec.toFixed(2)} m/s`,
      target: `${minS}–${maxS} m/s`,
      deviationPercent: null,
      passed: metrics.meanSpeedMetersPerSec >= minS && metrics.meanSpeedMetersPerSec <= maxS,
    });
  }

  checks.push({
    metric: 'EnergyLedger conservation',
    actual: `Δ=${metrics.energyDiscrepancy.toFixed(5)} EU`,
    target: 'balanced (<= 0.05 EU)',
    deviationPercent: null,
    passed: metrics.energyBalanced,
  });

  return checks;
}

/**
 * Executes a registered benchmark {@link ScenarioPreset} at full headless CPU speed, measuring
 * survival curves (`LT10/LT50/LT90`), death causes, locomotion kinematics (`speed`, `|ω|`), and
 * `EnergyLedger` conservation against its {@link EcologicalBenchmarkSpec}.
 */
export async function runScenarioBenchmark(
  preset: ScenarioPreset,
  options: {
    readonly seed?: number;
    readonly physicsFactory?: () => Promise<PhysicsAdapter>;
  } = {},
): Promise<ScenarioBenchmarkResult> {
  const spec = preset.benchmark;
  if (spec === undefined) {
    throw new Error(`Scenario preset "${preset.id}" does not define an EcologicalBenchmarkSpec.`);
  }

  const seed = options.seed ?? 42;
  const scenario = preset.create(seed);
  const physics =
    options.physicsFactory !== undefined
      ? await options.physicsFactory()
      : await createRapierPhysicsAdapter();

  const sim = new Simulation(
    {
      world: scenario.world,
      scenario,
      recordCommands: false,
      statsIntervalTicks: 30,
    },
    physics,
  );

  const trackedIds = new Set<EntityId>();
  for (const entity of sim.world.ecs.query(CreatureBrainComponent)) {
    const brain = sim.world.ecs.requireComponent(entity, CreatureBrainComponent);
    if (brain.speciesId === spec.targetSpeciesId) {
      trackedIds.add(entity);
    }
  }
  const initialCount = trackedIds.size;

  const dt = 1 / SIMULATION_DEFAULTS.physicsRateHz;
  const totalTicks = Math.ceil(spec.durationSeconds * SIMULATION_DEFAULTS.physicsRateHz);
  const deaths: TrackedDeathEvent[] = [];
  const deathCauses: Record<string, number> = {};

  let speedSum = 0;
  let omegaDegSum = 0;
  let peakOmegaDeg = 0;
  let kinematicSamples = 0;

  const startMs = performance.now();
  try {
    for (let tick = 1; tick <= totalTicks; tick += 1) {
      sim.stepFixed();
      const tSec = tick * dt;

      for (const rec of sim.getLastDeathRecords()) {
        if (trackedIds.has(rec.deadEntityId)) {
          deaths.push({ entityId: rec.deadEntityId, timeSeconds: tSec, cause: rec.deathCause });
          deathCauses[rec.deathCause] = (deathCauses[rec.deathCause] ?? 0) + 1;
        }
      }

      // Sample living target kinematics every 3 ticks (10 Hz)
      if (tick % 3 === 0) {
        for (const entity of sim.world.ecs.query(CreatureBrainComponent, PhysicsBodyComponent)) {
          const brain = sim.world.ecs.requireComponent(entity, CreatureBrainComponent);
          if (brain.speciesId !== spec.targetSpeciesId) continue;
          const body = sim.world.ecs.requireComponent(entity, PhysicsBodyComponent);
          const tr = sim.world.physics.getBodyTransform(body.bodyHandle);
          const speed = Math.hypot(tr.linearVelocity.x, tr.linearVelocity.y);
          const omegaDeg = Math.abs(tr.angularVelocity) * (180 / Math.PI);
          speedSum += speed;
          omegaDegSum += omegaDeg;
          if (omegaDeg > peakOmegaDeg) peakOmegaDeg = omegaDeg;
          kinematicSamples += 1;
        }
      }

      // Early exit if benchmark expects 100% mortality and all tracked entities are gone
      if (
        spec.expectedMortalityRange !== undefined &&
        spec.expectedMortalityRange[0] === 1 &&
        deaths.length >= initialCount &&
        initialCount > 0
      ) {
        break;
      }
    }

    const wallTimeMs = performance.now() - startMs;
    let finalAliveCount = 0;
    for (const entity of sim.world.ecs.query(CreatureBrainComponent)) {
      const brain = sim.world.ecs.requireComponent(entity, CreatureBrainComponent);
      if (brain.speciesId === spec.targetSpeciesId && trackedIds.has(entity)) {
        finalAliveCount += 1;
      }
    }

    const deathTimes = deaths.map((d) => d.timeSeconds).sort((a, b) => a - b);
    const firstDeathSeconds = deathTimes[0] ?? null;
    const lastDeathSeconds = deathTimes[deathTimes.length - 1] ?? null;
    const deathSpreadSeconds =
      firstDeathSeconds !== null && lastDeathSeconds !== null
        ? lastDeathSeconds - firstDeathSeconds
        : 0;

    const mortalityFraction = initialCount > 0 ? deaths.length / initialCount : 0;
    const starvationDeaths = deathCauses['starvation'] ?? 0;
    const starvationCauseFraction = deaths.length > 0 ? starvationDeaths / deaths.length : 0;
    const meanSpeedMetersPerSec = kinematicSamples > 0 ? speedSum / kinematicSamples : 0;
    const meanAngularSpeedDegPerSec = kinematicSamples > 0 ? omegaDegSum / kinematicSamples : 0;

    const audit = sim.ledger.audit(computeWorldEnergy(sim.world), 0.05);
    const lt10Seconds = percentile(deathTimes, 0.1);
    const lt50Seconds = percentile(deathTimes, 0.5);
    const lt90Seconds = percentile(deathTimes, 0.9);

    const checks = evaluateBenchmarkChecks(spec, {
      mortalityFraction,
      starvationCauseFraction,
      deathCount: deaths.length,
      lt50Seconds,
      deathSpreadSeconds,
      meanSpeedMetersPerSec,
      meanAngularSpeedDegPerSec,
      energyBalanced: audit.balanced,
      energyDiscrepancy: audit.discrepancy,
    });

    return {
      scenarioId: preset.id,
      label: preset.label,
      seed,
      referenceSource: spec.referenceSource,
      timeScaleLabel: spec.timeScaleLabel,
      durationSeconds: sim.world.timeSeconds,
      wallTimeMs,
      initialCount,
      finalAliveCount,
      mortalityFraction,
      deaths,
      deathCauses,
      lt10Seconds,
      lt50Seconds,
      lt90Seconds,
      firstDeathSeconds,
      lastDeathSeconds,
      deathSpreadSeconds,
      meanSpeedMetersPerSec,
      meanAngularSpeedDegPerSec,
      peakAngularSpeedDegPerSec: peakOmegaDeg,
      energyBalanced: audit.balanced,
      energyDiscrepancy: audit.discrepancy,
      checks,
      passed: checks.every((c) => c.passed),
    };
  } finally {
    sim.free();
  }
}

/**
 * Formats one or more {@link ScenarioBenchmarkResult}s into a readable CLI summary table.
 */
export function formatBenchmarkReport(results: readonly ScenarioBenchmarkResult[]): string {
  const lines: string[] = [];
  for (const res of results) {
    lines.push(
      `=== [${res.passed ? 'PASS' : 'FAIL'}] ${res.label} (id=${res.scenarioId}, seed=${res.seed}, wall=${res.wallTimeMs.toFixed(0)}ms) ===`,
    );
    lines.push(`Reference: ${res.referenceSource} | Scale: ${res.timeScaleLabel}`);
    lines.push(
      `Population: ${res.initialCount} -> ${res.finalAliveCount} alive | Deaths: ${res.deaths.length} (${JSON.stringify(res.deathCauses)})`,
    );
    if (res.deaths.length > 0) {
      lines.push(
        `Survival curve: first=${res.firstDeathSeconds?.toFixed(1)}s, LT10=${res.lt10Seconds?.toFixed(1)}s, LT50=${res.lt50Seconds?.toFixed(1)}s, LT90=${res.lt90Seconds?.toFixed(1)}s, last=${res.lastDeathSeconds?.toFixed(1)}s (spread=${res.deathSpreadSeconds.toFixed(1)}s)`,
      );
    }
    lines.push(
      `Kinematics: meanSpeed=${res.meanSpeedMetersPerSec.toFixed(2)} m/s | mean|ω|=${res.meanAngularSpeedDegPerSec.toFixed(1)} deg/s | peak|ω|=${res.peakAngularSpeedDegPerSec.toFixed(1)} deg/s`,
    );
    for (const c of res.checks) {
      const dev =
        c.deviationPercent !== null
          ? ` (${c.deviationPercent >= 0 ? '+' : ''}${c.deviationPercent.toFixed(1)}% vs ideal)`
          : '';
      lines.push(
        `  [${c.passed ? 'PASS' : 'FAIL'}] ${c.metric}: ${c.actual} | target: ${c.target}${dev}`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}
