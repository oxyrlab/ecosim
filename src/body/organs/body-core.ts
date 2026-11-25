import { z } from 'zod';
import { defineOrgan } from './organ-def';

/**
 * Primary torso organ providing structural mass and hosting internal body sensors.
 */
export const bodyCoreOrgan = defineOrgan({
  id: 'body-core',
  description: 'Primary torso structure providing body mass and hosting internal sensors.',
  params: z.object({}).default({}),
  defaultShape: { type: 'ellipse', w: 0.6, h: 0.35 },
  sensorSlots: 2,
  actuatorSlot: false,
  massDensity: 1.0,
});
