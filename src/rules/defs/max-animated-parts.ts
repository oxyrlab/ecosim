import { z } from 'zod';
import { expandBodyParts } from '@appearance/index';
import { defineRule } from '../define-rule';
import type { BlueprintBodySubject } from './subject';

/**
 * Caps the number of parts with visual animations per creature because each requires a dynamic sprite.
 */
export const maxAnimatedPartsRule = defineRule({
  id: 'max-animated-parts',
  description: 'Limits the number of animated parts per creature Blueprint.',
  rationale: 'Each animated part requires a separate dynamic sprite instead of a baked texture.',
  scope: 'blueprint',
  category: 'performance',
  defaultSeverity: 'warn',
  params: z.object({
    max: z.number().int().nonnegative().default(6),
  }),
  check(subject: BlueprintBodySubject, params) {
    const animatedCount = expandBodyParts(subject.body.parts).filter(
      (p) => p.anim.length > 0,
    ).length;
    if (animatedCount <= params.max) return [];
    return [
      {
        ruleId: 'max-animated-parts',
        severity: 'warn',
        message: `Creature has ${animatedCount} animated parts, exceeding limit ${params.max}.`,
        path: 'body.parts',
        actual: animatedCount,
        limit: params.max,
        suggestion:
          'Remove animations from minor decorative parts so they bake into the static texture.',
      },
    ];
  },
});
