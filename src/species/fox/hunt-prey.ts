import { z } from 'zod';
import { defineBrainModule, registerBrainModule } from '@brain/module-def';
import { port, type PortHandle } from '@bus/ports';
import { clamp } from '@core/index';

/**
 * Zod parameter schema for {@link foxHuntPreyModule}.
 */
export const foxHuntPreyParamsSchema = z.object({
  chaseSpeed: z.number().finite().min(0.2).max(1).default(0.95),
  stalkSpeed: z.number().finite().min(0.1).max(1).default(0.65),
  visionTurnGain: z.number().finite().positive().default(1.4),
  scentTurnGain: z.number().finite().positive().default(2.6),
  biteProximityThreshold: z.number().finite().min(0).max(1).default(0.84),
  minDriveToHunt: z.number().finite().min(0).max(1).default(0.05),
});

/** Validated parameters for {@link foxHuntPreyModule}. */
export type FoxHuntPreyParams = z.infer<typeof foxHuntPreyParamsSchema>;

/**
 * Fox species-specific predation module (`kind: 'rule'`): tracks visible prey or prey/corpse
 * scent gradients, accelerates into a pursuit chase, and emits a `bite` pulse at striking range.
 */
export const foxHuntPreyModule = registerBrainModule(
  defineBrainModule({
    id: 'fox-hunt-prey',
    kind: 'rule',
    description:
      'Species-specific predator pursuit module chasing visible prey or prey scent and triggering close-range bites.',
    params: foxHuntPreyParamsSchema,
    inputs: {
      drive: port.analog({
        range: [0, 1],
        unit: 'normalized',
        description: 'Hunger drive scaling hunting urgency [0, 1].',
      }),
      'seen.prey': port.analog({
        range: [0, 1],
        unit: 'normalized',
        description: 'Visual proximity of nearest prey [0, 1].',
      }),
      'dir.prey': port.analog({
        range: [-1, 1],
        unit: 'normalized',
        description: 'Visual bearing of nearest prey [-1 left, +1 right].',
      }),
      'scent.intensity': port.analog({
        range: [0, 1],
        unit: 'normalized',
        description: 'Prey scent intensity [0, 1].',
      }),
      'scent.gradient': port.analog({
        range: [-1, 1],
        unit: 'normalized',
        description: 'Prey scent right-minus-left gradient [-1, 1].',
      }),
    },
    outputs: {
      ...port.bundle('behavior'),
      bite: port.pulse({
        range: [0, 1],
        unit: 'normalized',
        description: 'Predatory bite pulse when prey is within striking proximity.',
      }),
    } as Readonly<Record<string, ReturnType<typeof port.analog>>>,
    create(params, { inputs, outputs }) {
      const urgencyH = outputs['urgency'] as PortHandle;
      const turnH = outputs['turn'] as PortHandle;
      const forwardH = outputs['forward'] as PortHandle;
      const biteH = outputs['bite'] as PortHandle;

      return {
        tick(input, output) {
          const drive = input.get(inputs.drive);
          const seen = input.get(inputs['seen.prey']);
          const dir = input.get(inputs['dir.prey']);
          const scentInt = input.get(inputs['scent.intensity']);
          const scentGrad = input.get(inputs['scent.gradient']);

          let urgency = 0;
          let turn = 0;
          let forward = 0;

          if (drive >= params.minDriveToHunt) {
            if (seen > 0.02) {
              urgency = clamp(0.4 + drive * 0.4 + seen * 0.4, 0, 1);
              turn = clamp(dir * params.visionTurnGain, -1, 1);
              forward = params.chaseSpeed;
            } else if (scentInt > 0.01) {
              urgency = clamp(drive * (0.35 + scentInt * 0.65), 0, 1);
              turn = clamp(scentGrad * params.scentTurnGain, -1, 1);
              forward = params.stalkSpeed;
            }
          }

          output.set(urgencyH, urgency);
          output.set(turnH, turn);
          output.set(forwardH, forward);
          output.set(
            biteH,
            seen >= params.biteProximityThreshold && drive >= params.minDriveToHunt ? 1 : 0,
          );
        },
      };
    },
  }),
);
