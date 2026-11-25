import { z } from 'zod';
import { expandBodyParts } from '@appearance/index';
import { defineRule } from '../define-rule';
import type { BlueprintBodySubject } from './subject';

/**
 * Limits the total number of expanded body parts per creature to bound layout and rendering cost.
 */
export const maxPartsPerCreatureRule = defineRule({
  id: 'max-parts-per-creature',
  description: 'Limits the total expanded body part count of a creature Blueprint.',
  rationale: 'Rendering and layout cost scale with the number of parts per creature.',
  scope: 'blueprint',
  category: 'performance',
  defaultSeverity: 'warn',
  params: z.object({
    max: z.number().int().positive().default(16),
  }),
  check(subject: BlueprintBodySubject, params) {
    const count = expandBodyParts(subject.body.parts).length;
    if (count <= params.max) return [];
    return [
      {
        ruleId: 'max-parts-per-creature',
        severity: 'warn',
        message: `Creature defines ${count} expanded body parts, exceeding limit ${params.max}.`,
        path: 'body.parts',
        actual: count,
        limit: params.max,
        suggestion: 'Merge decorative sub-parts or override this rule with a documented reason.',
      },
    ];
  },
});
