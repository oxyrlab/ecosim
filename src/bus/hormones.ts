import { InvalidParameterError } from '@core/index';
import type { MergePolicy } from './ports';

/**
 * Specification of a shared broadcast hormone channel inside every creature's endocrine space
 * (Section 5.2.2).
 */
export interface HormoneSpec {
  /** Stable dotted hormone channel id (e.g. `hormone.adrenaline`). */
  readonly id: string;
  /** Inclusive clamped value range `[min, max]`. */
  readonly range: readonly [min: number, max: number];
  /** Policy applied when multiple modules publish to this hormone (default `max`). */
  readonly merge: MergePolicy;
  /** Concise description surfaced in `docs/catalog/channels.md`. */
  readonly description: string;
}

/**
 * Built-in broadcast hormone channels (Section 5.2.2 & Section 5.3.1).
 */
export const HORMONE_SPECS: Readonly<Record<string, HormoneSpec>> = Object.freeze({
  'hormone.adrenaline': Object.freeze({
    id: 'hormone.adrenaline',
    range: [0, 1] as const,
    merge: 'max',
    description: 'Acute threat arousal boosting flight readiness and alertness.',
  }),
  'hormone.fatigue': Object.freeze({
    id: 'hormone.fatigue',
    range: [0, 1] as const,
    merge: 'max',
    description: 'Accumulated physical exhaustion suppressing high-energy actions.',
  }),
  'hormone.satiety': Object.freeze({
    id: 'hormone.satiety',
    range: [0, 1] as const,
    merge: 'max',
    description: 'Post-feeding fullness signal dampening hunger drives.',
  }),
  'hormone.reward': Object.freeze({
    id: 'hormone.reward',
    range: [0, 1] as const,
    merge: 'max',
    description: 'Positive neuromodulator signal gating appetitive learning (Phase 6).',
  }),
  'hormone.aversive': Object.freeze({
    id: 'hormone.aversive',
    range: [0, 1] as const,
    merge: 'max',
    description: 'Negative neuromodulator signal gating aversive / threat learning (Phase 6).',
  }),
});

/**
 * Looks up a built-in {@link HormoneSpec} by id.
 *
 * @throws InvalidParameterError if `id` is not a known hormone channel.
 */
export function getHormoneSpec(id: string): HormoneSpec {
  const spec = HORMONE_SPECS[id];
  if (spec === undefined) {
    throw new InvalidParameterError(
      'hormone',
      id,
      `one of [${Object.keys(HORMONE_SPECS).join(', ')}]`,
      'getHormoneSpec',
    );
  }
  return spec;
}
