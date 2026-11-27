import { z } from 'zod';
import { defineRule } from '../define-rule';
import type { RuleViolation } from '../types';
import type { BlueprintBodySubject } from './subject';

/**
 * Zod parameter schema for {@link learningRateBoundsRule}.
 */
export const learningRateBoundsParamsSchema = z
  .object({
    min: z.number().finite().positive().default(0.001),
    max: z.number().finite().positive().max(1).default(0.5),
  })
  .refine((v) => v.min <= v.max, { message: 'min must be <= max' });

/** Validated parameters for {@link learningRateBoundsRule}. */
export type LearningRateBoundsParams = z.infer<typeof learningRateBoundsParamsSchema>;

/**
 * Constraint Rule rejecting out-of-range learning rates both on initial Blueprints and after
 * evolutionary mutation (Section 5.11).
 */
export const learningRateBoundsRule = defineRule<LearningRateBoundsParams, BlueprintBodySubject>({
  id: 'learning-rate-bounds',
  description: 'Enforces safe lower and upper bounds on learningRate parameters.',
  scope: 'blueprint',
  category: 'physics-stability',
  defaultSeverity: 'error',
  rationale: 'Out-of-range rates make learning unstable or useless (also applies after mutation).',
  params: learningRateBoundsParamsSchema,
  check(subject, params) {
    const violations: RuleViolation[] = [];
    for (const mod of subject.brain?.modules ?? []) {
      const p =
        mod.params !== null && typeof mod.params === 'object'
          ? (mod.params as Record<string, unknown>)
          : undefined;
      if (p !== undefined && typeof p.learningRate === 'number') {
        if (p.learningRate < params.min || p.learningRate > params.max) {
          violations.push({
            ruleId: 'learning-rate-bounds',
            severity: 'error',
            message: `Learning module "${mod.instanceId}" learningRate (${p.learningRate}) is outside [${params.min}, ${params.max}].`,
            path: `brain.modules.${mod.instanceId}.params.learningRate`,
            actual: p.learningRate,
            limit: p.learningRate < params.min ? params.min : params.max,
            suggestion: `Clamp learningRate within [${params.min}, ${params.max}].`,
          });
        }
      }
    }
    return violations;
  },
});
