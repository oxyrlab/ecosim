import { z } from 'zod';
import { expandBodyParts } from '@appearance/index';
import { defineRule } from '../define-rule';
import type { BlueprintBodySubject } from './subject';

/**
 * Limits the total number of sensor instances hosted across a creature's expanded body parts.
 */
export const maxSensorsPerCreatureRule = defineRule({
  id: 'max-sensors-per-creature',
  description: 'Limits the total number of sensor instances per creature.',
  rationale:
    'Each sensor adds per-tick spatial query, raycast, or field sampling cost in SensorSystem.',
  scope: 'blueprint',
  category: 'performance',
  defaultSeverity: 'warn',
  params: z.object({
    max: z.number().int().nonnegative().default(8),
  }),
  check(subject: BlueprintBodySubject, params) {
    let total = 0;
    for (const part of expandBodyParts(subject.body.parts)) {
      total += part.sensors.length;
    }
    if (total <= params.max) return [];
    return [
      {
        ruleId: 'max-sensors-per-creature',
        severity: 'warn',
        message: `Creature hosts ${total} sensor instances, exceeding limit ${params.max}.`,
        path: 'body.parts',
        actual: total,
        limit: params.max,
        suggestion: 'Consolidate redundant sensors or lower sensor count.',
      },
    ];
  },
});
