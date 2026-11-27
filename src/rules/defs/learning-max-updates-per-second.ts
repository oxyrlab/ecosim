import { z } from 'zod';
import { defineRule } from '../define-rule';

/**
 * Runtime subject inspected by {@link learningMaxUpdatesPerSecondRule}.
 */
export interface LearningRuntimeSubject {
  /** Measured learning weight updates per second for a creature or module. */
  readonly updatesPerSecond: number;
}

/**
 * Zod parameter schema for {@link learningMaxUpdatesPerSecondRule}.
 */
export const learningMaxUpdatesParamsSchema = z.object({
  max: z.number().finite().positive().default(20),
});

/** Validated parameters for {@link learningMaxUpdatesPerSecondRule}. */
export type LearningMaxUpdatesParams = z.infer<typeof learningMaxUpdatesParamsSchema>;

/**
 * Runtime Constraint Rule verifying that learning remains event-driven rather than firing every
 * tick (Section 5.11).
 */
export const learningMaxUpdatesPerSecondRule = defineRule<
  LearningMaxUpdatesParams,
  LearningRuntimeSubject
>({
  id: 'learning-max-updates-per-second',
  description:
    'Warns when a creature triggers more learning updates per second than the configured cap.',
  scope: 'runtime',
  category: 'performance',
  defaultSeverity: 'warn',
  rationale: 'Learning must stay event-driven, not per tick.',
  params: learningMaxUpdatesParamsSchema,
  check(subject, params) {
    if (subject.updatesPerSecond <= params.max) return [];
    return [
      {
        ruleId: 'learning-max-updates-per-second',
        severity: 'warn',
        message: `Learning update rate (${subject.updatesPerSecond.toFixed(1)}/s) exceeds limit (${params.max}/s).`,
        actual: subject.updatesPerSecond,
        limit: params.max,
        suggestion: 'Ensure learn() is gated by modulator pulses and minLearnIntervalSeconds.',
      },
    ];
  },
});
