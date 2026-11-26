import { z } from 'zod';
import { port, type PortHandle } from '@bus/ports';
import { clamp } from '@core/index';
import { defineBrainModule } from '../module-def';

/**
 * Zod parameter schema for {@link seekGradientModule}.
 */
export const seekGradientParamsSchema = z.object({
  visionTurnGain: z.number().finite().positive().default(1.2),
  scentTurnGain: z.number().finite().positive().default(2.5),
  forwardSpeed: z.number().finite().min(0.1).max(1).default(0.8),
  biteProximityThreshold: z.number().finite().min(0).max(1).default(0.8),
  minDriveToBite: z.number().finite().min(0).max(1).default(0.1),
  urgencyFloor: z.number().finite().min(0).max(1).default(0.25),
});

/** Validated parameters for {@link seekGradientModule}. */
export type SeekGradientParams = z.infer<typeof seekGradientParamsSchema>;

/**
 * Shared steering brain module that tracks a target using vision (when visible) or stereo
 * olfactory scent gradient, outputs a `behavior` bundle (`urgency`, `turn`, `forward`), and emits
 * a `bite` pulse when close enough to feed.
 */
export const seekGradientModule = defineBrainModule({
  id: 'seek-gradient',
  kind: 'rule',
  description:
    'Steers toward a visual target or stereo olfactory gradient, outputting a behavior bundle and close-range bite pulse.',
  params: seekGradientParamsSchema,
  inputs: {
    drive: port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Motivational drive scaling output urgency (e.g. from hunger-drive).',
    }),
    seen: port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Visual target proximity [0, 1] from vision-sensor.',
    }),
    dir: port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Visual target bearing [-1, 1] from vision-sensor.',
    }),
    'scent.intensity': port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Mean olfactory intensity [0, 1] from olfactory-sensor.',
    }),
    'scent.gradient': port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Right-minus-left olfactory gradient [-1, 1] from olfactory-sensor.',
    }),
  },
  outputs: {
    ...port.bundle('behavior'),
    bite: port.pulse({
      range: [0, 1],
      unit: 'normalized',
      description: 'Bite pulse emitted when target proximity exceeds biteProximityThreshold.',
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
        const seen = input.get(inputs.seen);
        const dir = input.get(inputs.dir);
        const scentIntensity = input.get(inputs['scent.intensity']);
        const scentGradient = input.get(inputs['scent.gradient']);

        let turn = 0;
        let forward = 0;
        let cueStrength = 0;

        if (seen > 0.02) {
          turn = clamp(dir * params.visionTurnGain, -1, 1);
          forward = params.forwardSpeed;
          cueStrength = clamp(params.urgencyFloor + seen * (1 - params.urgencyFloor), 0, 1);
        } else if (scentIntensity > 0.01) {
          turn = clamp(scentGradient * params.scentTurnGain, -1, 1);
          forward = params.forwardSpeed * 0.75;
          cueStrength = clamp(
            params.urgencyFloor * 0.8 + scentIntensity * (1 - params.urgencyFloor * 0.8),
            0,
            1,
          );
        }

        const urgency = clamp(drive * cueStrength, 0, 1);
        output.set(urgencyH, urgency);
        output.set(turnH, turn);
        output.set(forwardH, forward);

        const shouldBite =
          seen >= params.biteProximityThreshold && drive >= params.minDriveToBite ? 1 : 0;
        output.set(biteH, shouldBite);
      },
    };
  },
});
