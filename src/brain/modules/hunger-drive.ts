import { z } from 'zod';
import { port } from '@bus/ports';
import { clamp } from '@core/index';
import { defineBrainModule } from '../module-def';

/**
 * Zod parameter schema for {@link hungerDriveModule}.
 */
export const hungerDriveParamsSchema = z.object({
  threshold: z.number().finite().min(0).max(0.95).default(0.15),
  exponent: z.number().finite().positive().default(1.3),
  gain: z.number().finite().positive().default(1.2),
});

/** Validated parameters for {@link hungerDriveModule}. */
export type HungerDriveParams = z.infer<typeof hungerDriveParamsSchema>;

/**
 * Shared utility brain module converting normalized energy deficit into foraging urgency (`urge`)
 * and broadcasting `hormone.satiety` (`1 - urge`) across the creature's nervous system.
 */
export const hungerDriveModule = defineBrainModule({
  id: 'hunger-drive',
  kind: 'utility',
  description:
    'Converts normalized energy deficit into a nonlinear foraging urge and broadcasts hormone.satiety.',
  params: hungerDriveParamsSchema,
  inputs: {
    deficit: port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Energy deficit (1 - energyRatio) from energy-sensor.',
    }),
  },
  outputs: {
    urge: port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Foraging drive urgency [0, 1].',
    }),
  },
  publish: ['hormone.satiety'],
  create(params, { inputs, outputs, publish }) {
    const satietyHormone = publish['hormone.satiety'];
    const span = Math.max(1e-6, 1 - params.threshold);
    return {
      tick(input, output) {
        const deficit = input.get(inputs.deficit);
        const normalized = clamp((deficit - params.threshold) / span, 0, 1);
        const urge = clamp(Math.pow(normalized, params.exponent) * params.gain, 0, 1);
        output.set(outputs.urge, urge);
        if (satietyHormone !== undefined) {
          output.set(satietyHormone, 1 - urge);
        }
      },
    };
  },
});
