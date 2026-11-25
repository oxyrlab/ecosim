import { z } from 'zod';
import { resolveLayout } from '@appearance/index';
import { defineRule } from '../define-rule';
import type { BlueprintBodySubject } from './subject';

/**
 * Limits the number of distinct physics rigid bodies per creature to bound solver cost.
 */
export const maxRigidBodiesPerCreatureRule = defineRule({
  id: 'max-rigid-bodies-per-creature',
  description: 'Limits the number of physics rigid bodies created by a creature Blueprint.',
  rationale: 'Each jointed sub-body adds solver constraints and physics step cost.',
  scope: 'blueprint',
  category: 'performance',
  defaultSeverity: 'warn',
  params: z.object({
    max: z.number().int().positive().default(6),
  }),
  check(subject: BlueprintBodySubject, params) {
    const layout = resolveLayout(subject.body.parts, subject.scale ?? 1, 'hull');
    const count = layout.rigidBodyGroups.length;
    if (count <= params.max) return [];
    return [
      {
        ruleId: 'max-rigid-bodies-per-creature',
        severity: 'warn',
        message: `Creature produces ${count} rigid bodies, exceeding limit ${params.max}.`,
        path: 'body.parts',
        actual: count,
        limit: params.max,
        suggestion: 'Convert non-articulated parts to "fixed" or "visual" joints.',
      },
    ];
  },
});
