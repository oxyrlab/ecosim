import { z } from 'zod';
import { defineBrainModule, registerBrainModule } from '@brain/module-def';
import { port, type PortHandle } from '@bus/ports';
import { clamp } from '@core/index';

/**
 * Zod parameter schema for {@link rabbitFleePredatorModule}.
 */
export const rabbitFleePredatorParamsSchema = z.object({
  visualFearGain: z.number().finite().positive().default(1.3),
  scentFearGain: z.number().finite().positive().default(0.75),
  painFearBoost: z.number().finite().positive().default(1.0),
  fearDecayPerSecond: z.number().finite().positive().default(0.35),
  escapeSpeed: z.number().finite().min(0.2).max(1).default(1.0),
});

/** Validated parameters for {@link rabbitFleePredatorModule}. */
export type RabbitFleePredatorParams = z.infer<typeof rabbitFleePredatorParamsSchema>;

/**
 * Rabbit species-specific flight module (`kind: 'rule'`): reacts to visual predators, predator
 * scent, and pain pulses by broadcasting `hormone.fear` and steering directly away from danger.
 */
export const rabbitFleePredatorModule = registerBrainModule(
  defineBrainModule({
    id: 'rabbit-flee-predator',
    kind: 'rule',
    description:
      'Species-specific herbivore flight reflex steering away from visual/olfactory predators and pain spikes.',
    params: rabbitFleePredatorParamsSchema,
    inputs: {
      'seen.predator': port.analog({
        range: [0, 1],
        unit: 'normalized',
        description: 'Visual proximity of nearest predator [0, 1].',
      }),
      'dir.predator': port.analog({
        range: [-1, 1],
        unit: 'normalized',
        description: 'Visual bearing of nearest predator [-1 left, +1 right].',
      }),
      'scent.intensity': port.analog({
        range: [0, 1],
        unit: 'normalized',
        description: 'Predator scent intensity [0, 1].',
      }),
      'scent.gradient': port.analog({
        range: [-1, 1],
        unit: 'normalized',
        description: 'Predator scent right-minus-left gradient [-1, 1].',
      }),
      pain: port.pulse({
        range: [0, 1],
        unit: 'normalized',
        description: 'One-tick pain spike from pain-sensor.',
      }),
    },
    outputs: {
      ...port.bundle('behavior'),
    },
    publish: ['hormone.adrenaline'],
    create(params, { inputs, outputs, publish }) {
      const urgencyH = outputs.urgency as PortHandle;
      const turnH = outputs.turn as PortHandle;
      const forwardH = outputs.forward as PortHandle;
      const fearH = publish['hormone.adrenaline'];

      let latchedFear = 0;
      let lastAwayTurn = 0;

      return {
        tick(input, output, dt) {
          const seen = input.get(inputs['seen.predator']);
          const dir = input.get(inputs['dir.predator']);
          const scentInt = input.get(inputs['scent.intensity']);
          const scentGrad = input.get(inputs['scent.gradient']);
          const pain = input.get(inputs.pain);

          const instantFear = clamp(
            Math.max(
              seen * params.visualFearGain,
              scentInt * params.scentFearGain,
              pain * params.painFearBoost,
            ),
            0,
            1,
          );

          latchedFear = Math.max(
            instantFear,
            Math.max(0, latchedFear - params.fearDecayPerSecond * dt),
          );

          if (seen > 0.02) {
            // Turn sharply away from predator bearing (if straight ahead, break right)
            lastAwayTurn = dir >= 0 ? -1 : 1;
          } else if (scentInt > 0.02 && Math.abs(scentGrad) > 1e-4) {
            lastAwayTurn = clamp(-scentGrad * 2, -1, 1);
          }

          output.set(urgencyH, latchedFear);
          output.set(turnH, latchedFear > 0.05 ? lastAwayTurn : 0);
          output.set(forwardH, latchedFear > 0.05 ? params.escapeSpeed : 0);
          if (fearH !== undefined) {
            output.set(fearH, latchedFear);
          }
        },
        serialize() {
          return { latchedFear, lastAwayTurn };
        },
      };
    },
  }),
);
