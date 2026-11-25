import { z } from 'zod';
import { inspectWiring } from '@bus/wiring';
import { defineRule } from '../define-rule';
import type { BlueprintBodySubject } from './subject';

/**
 * Warns when a declared component input port has no incoming wire in the Blueprint.
 */
export const unconnectedInputRule = defineRule({
  id: 'unconnected-input',
  description: 'Flags input ports that receive no incoming wire in a creature Blueprint.',
  rationale: 'An input port that is never fed is commonly an accidental wiring omission.',
  scope: 'blueprint',
  category: 'simplicity',
  defaultSeverity: 'warn',
  params: z.object({}).default({}),
  check(subject: BlueprintBodySubject) {
    if (subject.nervousGraph === undefined) return [];
    const diag = inspectWiring(subject.nervousGraph.endpoints, subject.nervousGraph.wires);
    return diag.unconnectedInputs.map((addr) => ({
      ruleId: 'unconnected-input',
      severity: 'warn',
      message: `Input port "${addr}" is never connected by any wire.`,
      path: `wiring.${addr}`,
      suggestion: 'Connect a matching output wire or verify default silent behavior is intended.',
    }));
  },
});
