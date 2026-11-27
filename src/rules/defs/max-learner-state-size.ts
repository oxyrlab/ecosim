import { z } from 'zod';
import { defineRule } from '../define-rule';
import type { RuleViolation } from '../types';
import type { BlueprintBodySubject } from './subject';

/**
 * Zod parameter schema for {@link maxLearnerStateSizeRule}.
 */
export const maxLearnerStateSizeParamsSchema = z.object({
  max: z.number().int().min(1).default(1024),
});

/** Validated parameters for {@link maxLearnerStateSizeRule}. */
export type MaxLearnerStateSizeParams = z.infer<typeof maxLearnerStateSizeParamsSchema>;

function estimateModuleStateSize(mod: {
  readonly module?: string;
  readonly params?: unknown;
}): number {
  const p =
    mod.params !== null && typeof mod.params === 'object'
      ? (mod.params as Record<string, unknown>)
      : undefined;
  if (p === undefined) return 0;

  if (typeof p.stateSize === 'number' && Number.isFinite(p.stateSize)) {
    return p.stateSize;
  }
  if (typeof p.memorySlots === 'number' && Number.isFinite(p.memorySlots)) {
    // Prototypes (5 floats) + EligibilityTraceLearner strengths & trace (2 floats) per slot
    return p.memorySlots * 7;
  }
  if (
    typeof p.inputCount === 'number' &&
    typeof p.outputCount === 'number' &&
    Array.isArray(p.hiddenSizes)
  ) {
    const sizes = [p.inputCount, ...(p.hiddenSizes as number[]), p.outputCount];
    let total = 0;
    for (let i = 0; i < sizes.length - 1; i += 1) {
      total += (sizes[i + 1] as number) * ((sizes[i] as number) + 1);
    }
    return total;
  }
  return 0;
}

/**
 * Constraint Rule bounding per-module learner/network state size (Section 5.11).
 */
export const maxLearnerStateSizeRule = defineRule<MaxLearnerStateSizeParams, BlueprintBodySubject>({
  id: 'max-learner-state-size',
  description: 'Limits the Float32Array state size of learning and NN brain modules per creature.',
  scope: 'blueprint',
  category: 'performance',
  defaultSeverity: 'warn',
  rationale: 'Memory per creature and serialization cost.',
  params: maxLearnerStateSizeParamsSchema,
  check(subject, params) {
    const violations: RuleViolation[] = [];
    for (const mod of subject.brain?.modules ?? []) {
      const size = estimateModuleStateSize(mod);
      if (size > params.max) {
        violations.push({
          ruleId: 'max-learner-state-size',
          severity: 'warn',
          message: `Brain module "${mod.instanceId}" state size (${size} floats) exceeds limit of ${params.max}.`,
          path: `brain.modules.${mod.instanceId}`,
          actual: size,
          limit: params.max,
          suggestion: 'Reduce memorySlots or hidden layer widths.',
        });
      }
    }
    return violations;
  },
});
