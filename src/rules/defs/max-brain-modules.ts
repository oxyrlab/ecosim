import { z } from 'zod';
import { defineRule } from '../define-rule';
import type { BlueprintBodySubject } from './subject';

/**
 * Limits the number of brain modules per creature to keep brains readable and within tick budget.
 */
export const maxBrainModulesRule = defineRule({
  id: 'max-brain-modules',
  description: 'Limits the number of brain modules instantiated by a creature Blueprint.',
  rationale: 'Keeps modular brains inspectable and bounds BrainSystem execution cost.',
  scope: 'blueprint',
  category: 'simplicity',
  defaultSeverity: 'warn',
  params: z.object({
    max: z.number().int().nonnegative().default(12),
  }),
  check(subject: BlueprintBodySubject, params) {
    const count = subject.brain?.modules.length ?? 0;
    if (count <= params.max) return [];
    return [
      {
        ruleId: 'max-brain-modules',
        severity: 'warn',
        message: `Creature defines ${count} brain modules, exceeding limit ${params.max}.`,
        path: 'brain.modules',
        actual: count,
        limit: params.max,
        suggestion: 'Simplify brain topology or override this rule with a documented reason.',
      },
    ];
  },
});
