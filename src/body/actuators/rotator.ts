import { z } from 'zod';
import { port } from '@bus/ports';
import { defineActuator } from './actuator-def';

/**
 * Zod parameter schema for {@link rotatorActuator}.
 */
export const rotatorParamsSchema = z.object({
  maxTorqueNewtonMeters: z.number().finite().positive().default(2.5),
  energyPerTorqueSecond: z.number().finite().nonnegative().default(0.04),
  baseEnergyPerSecond: z.number().finite().nonnegative().default(0),
});

/** Validated parameters for {@link rotatorActuator}. */
export type RotatorParams = z.infer<typeof rotatorParamsSchema>;

/**
 * Pure rotational actuator applying torque (`N·m`) directly to its target physical body.
 */
export const rotatorActuator = defineActuator({
  id: 'rotator',
  description: 'Angular steering actuator applying torque around the body center.',
  params: rotatorParamsSchema,
  inputs: {
    turn: port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Torque command in [-1, 1] scaled by maxTorqueNewtonMeters.',
    }),
  },
  energyCost(params) {
    return {
      basePerSecond: params.baseEnergyPerSecond,
      perUnitEffortPerSecond: params.maxTorqueNewtonMeters * params.energyPerTorqueSecond,
      perAction: 0,
    };
  },
  create(params, { inputs }) {
    return {
      apply(ctx, input, dt) {
        const turn = input.get(inputs.turn);
        const torque = turn * params.maxTorqueNewtonMeters;
        if (Math.abs(torque) > 1e-9) {
          ctx.applyTorque(torque);
        }
        const cost =
          (params.baseEnergyPerSecond + Math.abs(torque) * params.energyPerTorqueSecond) * dt;
        if (cost > 0) {
          ctx.consumeEnergy(cost);
        }
      },
    };
  },
});
