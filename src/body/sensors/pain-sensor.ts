import { z } from 'zod';
import { port } from '@bus/ports';
import { defineSensor } from './sensor-def';

/**
 * Zod parameter schema for {@link painSensor}.
 */
export const painSensorParamsSchema = z.object({}).default({});

/**
 * Internal nociceptive sensor publishing a one-tick `pain` pulse whenever the creature takes
 * damage, along with continuous normalized `health` (`[0, 1]`).
 */
export const painSensor = defineSensor({
  id: 'pain-sensor',
  description:
    'Internal nociceptive sensor emitting a one-tick pain pulse on damage and continuous health ratio.',
  params: painSensorParamsSchema,
  sampleRateHz: 30,
  outputs: {
    pain: port.pulse({
      range: [0, 1],
      unit: 'normalized',
      description: 'One-tick pain spike proportional to damage received this tick.',
    }),
    health: port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Current health divided by maximum health [0, 1].',
    }),
  },
  create(_params, { outputs }) {
    return {
      sample(ctx, out) {
        out.set(outputs.pain, ctx.bodyState?.painPulse ?? 0);
        out.set(outputs.health, ctx.bodyState?.healthRatio ?? 1);
      },
    };
  },
});
