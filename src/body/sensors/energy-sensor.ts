import { z } from 'zod';
import { port } from '@bus/ports';
import { defineSensor } from './sensor-def';

/**
 * Zod parameter schema for {@link energySensor}.
 */
export const energySensorParamsSchema = z.object({}).default({});

/**
 * Internal proprioceptive sensor reading the creature's own normalized energy reserve (`level`)
 * and energy deficit (`deficit = 1 - level`) onto the `SignalBus`.
 */
export const energySensor = defineSensor({
  id: 'energy-sensor',
  description:
    'Internal proprioceptive sensor reporting normalized body energy level and hunger deficit.',
  params: energySensorParamsSchema,
  sampleRateHz: 10,
  outputs: {
    level: port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Current energy divided by maximum energy capacity [0, 1].',
    }),
    deficit: port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Normalized energy deficit (1 - level) driving hunger modules.',
    }),
  },
  create(_params, { outputs }) {
    return {
      sample(ctx, out) {
        const ratio = ctx.bodyState?.energyRatio ?? 1;
        out.set(outputs.level, ratio);
        out.set(outputs.deficit, 1 - ratio);
      },
    };
  },
});
