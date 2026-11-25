import { z } from 'zod';
import { resolveWiring } from '@bus/wiring';
import { defineRule } from '../define-rule';
import type { BlueprintBodySubject } from './subject';

/**
 * Limits the total number of scalar channels allocated on a creature's SignalBus.
 */
export const maxBusChannelsRule = defineRule({
  id: 'max-bus-channels',
  description: 'Limits the number of Float32Array channels allocated on a creature SignalBus.',
  rationale: 'Bus memory footprint and swap cost scale linearly with channel count per creature.',
  scope: 'blueprint',
  category: 'performance',
  defaultSeverity: 'warn',
  params: z.object({
    max: z.number().int().positive().default(512),
  }),
  check(subject: BlueprintBodySubject, params) {
    if (subject.nervousGraph === undefined) return [];
    const { bus } = resolveWiring(subject.nervousGraph.endpoints, subject.nervousGraph.wires);
    if (bus.channelCount <= params.max) return [];
    return [
      {
        ruleId: 'max-bus-channels',
        severity: 'warn',
        message: `Creature SignalBus allocates ${bus.channelCount} channels, exceeding limit ${params.max}.`,
        path: 'wiring',
        actual: bus.channelCount,
        limit: params.max,
        suggestion: 'Reduce sensor sector counts or unused ports.',
      },
    ];
  },
});
