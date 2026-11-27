import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import {
  createNeuromodulatorState,
  decayNeuromodulators,
  triggerAversiveModulator,
  triggerRewardModulator,
} from './modulators';

describe('neuromodulator pulses (ADR 0010)', () => {
  it('latches proportional reward/aversive pulses and decays cleanly to zero', () => {
    const state = createNeuromodulatorState();
    expect(state).toEqual({ reward: 0, aversive: 0 });

    triggerRewardModulator(state, 0.7);
    triggerRewardModulator(state, 0.3); // keeps stronger peak
    expect(state.reward).toBeCloseTo(0.7);

    triggerAversiveModulator(state, 1.5); // clamped to 1
    expect(state.aversive).toBe(1);

    decayNeuromodulators(state, 0.2);
    expect(state.reward).toBeLessThan(0.3);
    expect(state.aversive).toBeLessThan(0.4);

    // Decays cleanly to 0 well within 2 seconds
    decayNeuromodulators(state, 2);
    expect(state.reward).toBe(0);
    expect(state.aversive).toBe(0);

    expect(() => decayNeuromodulators(state, -1)).toThrow(InvalidParameterError);
    expect(() => decayNeuromodulators(state, 0.1, 0)).toThrow(InvalidParameterError);
  });
});
