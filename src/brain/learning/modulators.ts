import { assertFiniteNumber, clamp, InvalidParameterError } from '@core/index';

/**
 * Default exponential decay time constant (`τ = 0.2 s`) for `hormone.reward` and
 * `hormone.aversive` per ADR 0010 (effectively returns to zero in `< 0.5 s`).
 */
export const DEFAULT_MODULATOR_TAU_SECONDS = 0.2;

/**
 * Per-creature short-lived neuromodulator pulse levels (ADR 0010).
 * These signals ONLY gate learning modules and never directly alter innate behaviors.
 */
export interface NeuromodulatorState {
  /** Normalized `[0, 1]` reward level triggered by eating or reproduction. */
  reward: number;
  /** Normalized `[0, 1]` aversive level triggered by damage or starvation. */
  aversive: number;
}

/**
 * Creates a zero-initialized {@link NeuromodulatorState}.
 */
export function createNeuromodulatorState(): NeuromodulatorState {
  return { reward: 0, aversive: 0 };
}

/**
 * Releases a raw normalized reward pulse (`hormone.reward`) into `state` (ADR 0010).
 */
export function triggerRewardModulator(state: NeuromodulatorState, strength: number): void {
  assertFiniteNumber('strength', strength, 'triggerRewardModulator');
  const clamped = clamp(strength, 0, 1);
  if (clamped > state.reward) {
    state.reward = clamped;
  }
}

/**
 * Releases a raw normalized aversive pulse (`hormone.aversive`) into `state` (ADR 0010).
 */
export function triggerAversiveModulator(state: NeuromodulatorState, strength: number): void {
  assertFiniteNumber('strength', strength, 'triggerAversiveModulator');
  const clamped = clamp(strength, 0, 1);
  if (clamped > state.aversive) {
    state.aversive = clamped;
  }
}

/**
 * Decays both neuromodulator channels exponentially over `dt` seconds, snapping tiny tails
 * (`< 1e-3`) cleanly to `0`.
 */
export function decayNeuromodulators(
  state: NeuromodulatorState,
  dt: number,
  tauSeconds = DEFAULT_MODULATOR_TAU_SECONDS,
): void {
  assertFiniteNumber('dt', dt, 'decayNeuromodulators');
  if (dt < 0) {
    throw new InvalidParameterError('dt', dt, 'a finite number >= 0', 'decayNeuromodulators');
  }
  if (!Number.isFinite(tauSeconds) || tauSeconds <= 0) {
    throw new InvalidParameterError(
      'tauSeconds',
      tauSeconds,
      'a finite number > 0',
      'decayNeuromodulators',
    );
  }
  const factor = Math.exp(-dt / tauSeconds);
  state.reward *= factor;
  state.aversive *= factor;
  if (state.reward < 1e-3) state.reward = 0;
  if (state.aversive < 1e-3) state.aversive = 0;
}
