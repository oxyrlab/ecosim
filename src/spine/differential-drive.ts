import { z } from 'zod';
import { port } from '@bus/ports';
import { clamp } from '@core/index';
import { defineSpine } from './spine-def';

/**
 * Zod parameter schema for {@link differentialDriveSpine}.
 */
export const differentialDriveParamsSchema = z.object({
  forwardGain: z.number().finite().positive().default(1),
  turnGain: z.number().finite().positive().default(1),
});

/** Validated parameters for {@link differentialDriveSpine}. */
export type DifferentialDriveParams = z.infer<typeof differentialDriveParamsSchema>;

/**
 * Generic differential-drive spine mapping high-level brain motor patterns (`move.forward`,
 * `move.turn`, `action.bite`) into left/right thruster commands (`left.power`, `right.power`),
 * optional direct `rotator.turn`, and `mouth.bite`.
 *
 * Turning right (`move.turn > 0`) boosts `left.power` and reduces `right.power`, creating
 * clockwise (`+angle`) torque around the creature's center when left is `-Y` and right is `+Y`.
 */
export const differentialDriveSpine = defineSpine({
  id: 'differential-drive',
  description:
    'Generic motor translator mapping (move.forward, move.turn, action.bite) to differential left/right thrusters, rotator, and mouth.',
  params: differentialDriveParamsSchema,
  inputs: {
    'move.forward': port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Desired forward/reverse locomotion speed.',
    }),
    'move.turn': port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Desired turning rate (-1 left, +1 right).',
    }),
    'action.bite': port.pulse({
      range: [0, 1],
      unit: 'normalized',
      description: 'Pulse requesting a bite action.',
    }),
  },
  outputs: {
    'left.power': port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Left thruster power command.',
    }),
    'right.power': port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Right thruster power command.',
    }),
    'rotator.turn': port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Direct torque command for optional rotator actuator.',
    }),
    'mouth.bite': port.pulse({
      range: [0, 1],
      unit: 'normalized',
      description: 'Forwarded bite trigger pulse for mouth actuator.',
    }),
  },
  create(params, { inputs, outputs }) {
    return {
      tick(input, output) {
        const fwd = input.get(inputs['move.forward']) * params.forwardGain;
        const turn = input.get(inputs['move.turn']) * params.turnGain;

        output.set(outputs['left.power'], clamp(fwd + turn, -1, 1));
        output.set(outputs['right.power'], clamp(fwd - turn, -1, 1));
        output.set(outputs['rotator.turn'], clamp(turn, -1, 1));
        output.set(outputs['mouth.bite'], input.get(inputs['action.bite']));
      },
    };
  },
});
