import { describe, expect, it } from 'vitest';
import { SIMULATION_DEFAULTS } from './simulation';

describe('SIMULATION_DEFAULTS', () => {
  it('defines consistent SI simulation rates', () => {
    expect(Object.isFrozen(SIMULATION_DEFAULTS)).toBe(true);
    expect(SIMULATION_DEFAULTS.physicsRateHz).toBe(30);
    expect(SIMULATION_DEFAULTS.fixedTimestepSeconds).toBeCloseTo(1 / 30);
    expect(SIMULATION_DEFAULTS.brainRateHz).toBe(10);
    expect(SIMULATION_DEFAULTS.visionSampleRateHz).toBe(10);
    expect(SIMULATION_DEFAULTS.fieldDiffusionRateHz).toBe(5);
  });
});
