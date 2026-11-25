import { z } from 'zod';
import { resolveLayout } from '@appearance/index';
import { defineRule } from '../define-rule';
import type { BlueprintBodySubject } from './subject';

/**
 * Limits the longest chain of jointed rigid bodies on a single creature for solver stability.
 */
export const maxJointChainLengthRule = defineRule({
  id: 'max-joint-chain-length',
  description: 'Limits the maximum number of rigid bodies in a single jointed chain.',
  rationale: 'Long jointed chains accumulate constraint error and become unstable in the solver.',
  scope: 'blueprint',
  category: 'physics-stability',
  defaultSeverity: 'warn',
  params: z.object({
    max: z.number().int().positive().default(8),
  }),
  check(subject: BlueprintBodySubject, params) {
    const layout = resolveLayout(subject.body.parts, subject.scale ?? 1, 'hull');
    let longest = 0;
    for (const group of layout.rigidBodyGroups) {
      const length = group.chainDepth + 1;
      if (length > longest) longest = length;
    }
    if (longest <= params.max) return [];
    return [
      {
        ruleId: 'max-joint-chain-length',
        severity: 'warn',
        message: `Joint chain length ${longest} exceeds limit ${params.max}.`,
        path: 'body.parts',
        actual: longest,
        limit: params.max,
        suggestion: 'Shorten the articulated chain or make terminal segments visual-only.',
      },
    ];
  },
});
