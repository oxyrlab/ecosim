import type { RuleConfigEntry } from '@rules/types';

/**
 * Layer 1 default values for registered Constraint Rules (Section 5.11).
 * Default numbers are conservative starting estimates and change only based on benchmarks
 * recorded in `docs/CHANGELOG.md`.
 */
export const DEFAULT_RULE_CONFIG: Readonly<Record<string, RuleConfigEntry>> = Object.freeze({
  'max-parts-per-creature': { severity: 'warn', params: { max: 16 } },
  'max-rigid-bodies-per-creature': { severity: 'warn', params: { max: 6 } },
  'max-joint-chain-length': { severity: 'warn', params: { max: 8 } },
  'max-mass-ratio-jointed': { severity: 'warn', params: { maxRatio: 10 } },
  'min-collider-size': { severity: 'error', params: { minMeters: 0.02 } },
  'max-animated-parts': { severity: 'warn', params: { max: 6 } },
  'max-convex-vertices': { severity: 'warn', params: { max: 16 } },
  'collider-concave-strategy': { severity: 'error', params: { strategy: 'hull' } },
  'max-sensors-per-creature': { severity: 'warn', params: { max: 8 } },
  'max-brain-modules': { severity: 'warn', params: { max: 12 } },
  'max-bus-channels': { severity: 'warn', params: { max: 512 } },
  'unmerged-fan-in': { severity: 'error', params: {} },
  'unconnected-input': { severity: 'warn', params: {} },
  'unused-output': { severity: 'off', params: {} },
  'numeric-index-on-logical-port': { severity: 'error', params: {} },
  'max-learner-state-size': { severity: 'warn', params: { max: 1024 } },
  'max-memory-slots': { severity: 'warn', params: { max: 16 } },
  'learning-rate-bounds': { severity: 'error', params: { min: 0.001, max: 0.5 } },
  'learning-max-updates-per-second': { severity: 'warn', params: { max: 20 } },
});
