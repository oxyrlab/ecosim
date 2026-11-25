import { z } from 'zod';
import { defineOrgan } from './organ-def';

/**
 * Sensory nose organ hosting an olfactory gradient sensor.
 */
export const noseOrgan = defineOrgan({
  id: 'nose',
  description: 'Forward sensory organ hosting a stereo olfactory scent sensor.',
  params: z.object({}).default({}),
  defaultShape: { type: 'triangle', w: 0.05, h: 0.04 },
  sensorSlots: 1,
  actuatorSlot: false,
  massDensity: 0.4,
});
