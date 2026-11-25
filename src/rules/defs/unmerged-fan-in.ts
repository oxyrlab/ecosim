import { z } from 'zod';
import { inspectWiring } from '@bus/wiring';
import { defineRule } from '../define-rule';
import type { BlueprintBodySubject } from './subject';

/**
 * Rejects fan-in wiring into an input port that does not declare an explicit `merge` policy.
 */
export const unmergedFanInRule = defineRule({
  id: 'unmerged-fan-in',
  description:
    'Requires an explicit merge policy (sum|max|min|avg) whenever multiple wires feed one input.',
  rationale:
    'Several wires into one input without a merge policy would cause ambiguous overwrites.',
  scope: 'blueprint',
  category: 'engine-requirement',
  defaultSeverity: 'error',
  params: z.object({}).default({}),
  check(subject: BlueprintBodySubject) {
    if (subject.nervousGraph === undefined) return [];
    const diag = inspectWiring(subject.nervousGraph.endpoints, subject.nervousGraph.wires);
    return diag.unmergedFanIns.map((item) => ({
      ruleId: 'unmerged-fan-in',
      severity: 'error',
      message: `Input "${item.target}" receives ${item.sources.length} wires (${item.sources.join(', ')}) without a merge policy.`,
      path: `wiring.${item.target}`,
      actual: item.sources.length,
      limit: 1,
      suggestion: 'Declare merge: "sum" | "max" | "min" | "avg" on the target input port.',
    }));
  },
});
