import { z } from 'zod';
import { defineRule } from '../define-rule';
import type { RuleViolation } from '../types';
import type { BlueprintBodySubject } from './subject';

/**
 * Zod parameter schema for {@link maxMemorySlotsRule}.
 */
export const maxMemorySlotsParamsSchema = z.object({
  max: z.number().int().min(1).default(16),
});

/** Validated parameters for {@link maxMemorySlotsRule}. */
export type MaxMemorySlotsParams = z.infer<typeof maxMemorySlotsParamsSchema>;

/**
 * Constraint Rule keeping associative memory slot counts small and inspectable (Section 5.11).
 */
export const maxMemorySlotsRule = defineRule<MaxMemorySlotsParams, BlueprintBodySubject>({
  id: 'max-memory-slots',
  description: 'Limits the number of associative memory slots declared on a learning module.',
  scope: 'blueprint',
  category: 'simplicity',
  defaultSeverity: 'warn',
  rationale: 'Keeps learned memory small and inspectable.',
  params: maxMemorySlotsParamsSchema,
  check(subject, params) {
    const violations: RuleViolation[] = [];
    for (const mod of subject.brain?.modules ?? []) {
      const p =
        mod.params !== null && typeof mod.params === 'object'
          ? (mod.params as Record<string, unknown>)
          : undefined;
      if (p !== undefined && typeof p.memorySlots === 'number' && p.memorySlots > params.max) {
        violations.push({
          ruleId: 'max-memory-slots',
          severity: 'warn',
          message: `Learning module "${mod.instanceId}" declares ${p.memorySlots} memorySlots (limit ${params.max}).`,
          path: `brain.modules.${mod.instanceId}.params.memorySlots`,
          actual: p.memorySlots,
          limit: params.max,
          suggestion: `Set memorySlots <= ${params.max}.`,
        });
      }
    }
    return violations;
  },
});
