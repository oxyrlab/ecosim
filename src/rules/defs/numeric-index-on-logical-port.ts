import { z } from 'zod';
import { inspectWiring } from '@bus/wiring';
import { defineRule } from '../define-rule';
import type { BlueprintBodySubject } from './subject';

/**
 * Rejects numeric `[index]` syntax on scalar logical ports; indexing is allowed only for spatial arrays.
 */
export const numericIndexOnLogicalPortRule = defineRule({
  id: 'numeric-index-on-logical-port',
  description: 'Forbids numeric [index] addressing on non-array logical ports.',
  rationale:
    'Logical slots must be named (e.g. arbiter:flee.urgency); indices are reserved for spatial arrays.',
  scope: 'blueprint',
  category: 'simplicity',
  defaultSeverity: 'error',
  params: z.object({}).default({}),
  check(subject: BlueprintBodySubject) {
    if (subject.nervousGraph === undefined) return [];
    const diag = inspectWiring(subject.nervousGraph.endpoints, subject.nervousGraph.wires);
    return diag.numericIndexOnLogicalPorts.map((addr) => ({
      ruleId: 'numeric-index-on-logical-port',
      severity: 'error',
      message: `Address "${addr}" applies a numeric index to a scalar logical port.`,
      path: `wiring.${addr}`,
      suggestion: 'Use a named logical port or declare count on a genuinely spatial array port.',
    }));
  },
});
