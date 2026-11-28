import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import {
  getScenarioPreset,
  listBenchmarkPresets,
  listScenarioPresets,
  SCENARIO_PRESETS,
} from './scenario-registry';

describe('scenario-registry', () => {
  it('registers built-in ecosystem, benchmark, and sandbox scenarios including 5-rabbit starvation', () => {
    const summaries = listScenarioPresets();
    expect(summaries.length).toBe(SCENARIO_PRESETS.length);
    expect(summaries.some((s) => s.id === 'rabbit-starvation-5' && s.hasBenchmark)).toBe(true);

    const starvationPreset = getScenarioPreset('rabbit-starvation-5');
    const cfg = starvationPreset.create(42);
    expect(cfg.initialSpawns).toHaveLength(5);
    const females = cfg.initialSpawns.filter((s) => s.reproductiveOrgan === 'reproductive-female');
    const males = cfg.initialSpawns.filter((s) => s.reproductiveOrgan === 'reproductive-male');
    const plants = cfg.initialSpawns.filter(
      (s) => s.speciesId === 'grass' || s.speciesId === 'berry-bush',
    );
    expect(females).toHaveLength(3);
    expect(males).toHaveLength(2);
    expect(plants).toHaveLength(0);

    expect(listBenchmarkPresets().length).toBeGreaterThanOrEqual(2);
    expect(() => getScenarioPreset('unknown-preset')).toThrow(InvalidParameterError);
  });
});
