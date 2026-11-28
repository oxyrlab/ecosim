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
          const deadzonedDir = Math.abs(dir) < 0.04 ? 0 : dir;
          turn = clamp(deadzonedDir * params.visionTurnGain, -1, 1);
          // Slow down strongly when target is off-axis so the creature pivots to face food instead of orbiting it.
          const alignment = clamp(1 - 1.65 * Math.abs(dir), 0.05, 1);
          const approachScale = seen > 0.88 ? 0.45 : 1;
          forward = params.forwardSpeed * alignment * approachScale;
          cueStrength = clamp(params.urgencyFloor + seen * (1 - params.urgencyFloor), 0, 1);
        } else if (scentIntensity > 0.01) {
          const deadzonedGrad = Math.abs(scentGradient) < 0.03 ? 0 : scentGradient;
          turn = clamp(deadzonedGrad * params.scentTurnGain, -1, 1);
          const alignment = clamp(1 - 0.85 * Math.abs(turn), 0.15, 1);
          forward = params.forwardSpeed * 0.72 * alignment;
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

        const facingTarget = Math.abs(dir) <= 0.35;
        const shouldBite =
          seen >= params.biteProximityThreshold && facingTarget && drive >= params.minDriveToBite
            ? 1
            : 0;
        output.set(biteH, shouldBite);
      },
    };
  },
});
