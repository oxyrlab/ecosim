import { describe, expect, it } from 'vitest';
import { getScenarioPreset } from '@sim/index';
import { formatBenchmarkReport, runScenarioBenchmark } from './benchmark';

describe('ecological scenario benchmarks (real Rapier 2D WASM)', () => {
  it('passes the 5-rabbit (3F, 2M) zero-plant starvation benchmark against biological reference bounds', async () => {
    const preset = getScenarioPreset('rabbit-starvation-5');
    const result = await runScenarioBenchmark(preset, { seed: 42 });
    const report = formatBenchmarkReport([result]);

    expect(report).toContain('rabbit-starvation-5');
    expect(result.initialCount).toBe(5);
    expect(result.finalAliveCount).toBe(0);
    expect(result.deathCauses['starvation']).toBe(5);
    expect(result.deathCauses['aging'] ?? 0).toBe(0);
    expect(result.meanAngularSpeedDegPerSec).toBeLessThanOrEqual(180);
    expect(result.energyBalanced).toBe(true);
    expect(result.passed).toBe(true);
  }, 30_000);

  it('passes the 5-rabbit (3F, 2M) grass meadow foraging control benchmark', async () => {
    const preset = getScenarioPreset('rabbit-foraging-5');
    const result = await runScenarioBenchmark(preset, { seed: 42 });
    expect(result.initialCount).toBe(5);
    expect(result.finalAliveCount).toBeGreaterThanOrEqual(4);
    expect(result.meanAngularSpeedDegPerSec).toBeLessThanOrEqual(180);
    expect(result.energyBalanced).toBe(true);
    expect(result.passed).toBe(true);
  }, 30_000);
});
