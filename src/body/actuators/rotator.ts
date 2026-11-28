import { z } from 'zod';
import { port } from '@bus/ports';
import { clamp } from '@core/index';
import { defineActuator } from './actuator-def';

/**
 * Zod parameter schema for {@link rotatorActuator}.
 */
export const rotatorParamsSchema = z.object({
  maxTorqueNewtonMeters: z.number().finite().positive().default(2.5),
  /** Peak target angular speed in `rad/s` (~240 deg/s) used when closed-loop `angularVelocity` is provided. */
  maxAngularSpeedRadPerSec: z.number().finite().positive().default(4.2),
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
        // 2D moment of inertia scales with scale^4; scale max torque allometrically to prevent juvenile over-spinning.
        const bodyScale = ctx.bodyScale ?? 1;
        const s2 = bodyScale * bodyScale;
        const maxTorque = params.maxTorqueNewtonMeters * s2 * s2;

        let torque: number;
        if (ctx.angularVelocity !== undefined) {
          const targetOmega = turn * params.maxAngularSpeedRadPerSec;
          const omegaError = targetOmega - ctx.angularVelocity;
          // Proportional rate controller (Kp = 2.5) tracks targetOmega crisply while strictly braking any excess spin.
          const effort = clamp((omegaError / params.maxAngularSpeedRadPerSec) * 2.5, -1, 1);
          torque = effort * maxTorque;
        } else {
          torque = turn * maxTorque;
        }

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
