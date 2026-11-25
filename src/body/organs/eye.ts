import { z } from 'zod';
import { defineOrgan } from './organ-def';

/**
 * Sensory eye organ hosting a single vision sensor.
 */
export const eyeOrgan = defineOrgan({
  id: 'eye',
  description: 'Circular sensory organ hosting a directional vision sensor.',
  params: z.object({}).default({}),
  defaultShape: { type: 'circle', r: 0.04 },
  sensorSlots: 1,
  actuatorSlot: false,
  massDensity: 0.5,
});
