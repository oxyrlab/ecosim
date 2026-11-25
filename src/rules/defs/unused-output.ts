import { z } from 'zod';
import { inspectWiring } from '@bus/wiring';
import { defineRule } from '../define-rule';
import type { BlueprintBodySubject } from './subject';

/**
 * Optional diagnostic rule flagging declared outputs that no wire reads (default severity: `off`).
 */
export const unusedOutputRule = defineRule({
  id: 'unused-output',
  description:
    'Flags output ports that are not wired to any consumer (useful when pruning genomes).',
  rationale: 'Highlights dead wiring outputs during manual inspection or genome cleanup.',
  scope: 'blueprint',
  category: 'simplicity',
  defaultSeverity: 'off',
  params: z.object({}).default({}),
  check(subject: BlueprintBodySubject) {
    if (subject.nervousGraph === undefined) return [];
    const diag = inspectWiring(subject.nervousGraph.endpoints, subject.nervousGraph.wires);
    return diag.unusedOutputs.map((addr) => ({
      ruleId: 'unused-output',
      severity: 'warn',
      message: `Output port "${addr}" is not consumed by any wire.`,
      path: `wiring.${addr}`,
      suggestion: 'Wire this output or disable unused sensors/modules.',
    }));
  },
});
