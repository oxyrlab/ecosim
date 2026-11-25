import { z } from 'zod';
import { defineOrgan } from './organ-def';

/**
 * Feeding and predation mouth organ hosting a bite actuator.
 */
export const mouthOrgan = defineOrgan({
  id: 'mouth',
  description: 'Anterior feeding organ hosting a discrete bite actuator.',
  params: z.object({}).default({}),
  defaultShape: { type: 'rect', w: 0.06, h: 0.05 },
  sensorSlots: 0,
  actuatorSlot: true,
  massDensity: 0.8,
});
