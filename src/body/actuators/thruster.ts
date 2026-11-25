import { z } from 'zod';
import { port } from '@bus/ports';
import { defineActuator } from './actuator-def';

/**
 * Zod parameter schema for {@link thrusterActuator}.
 */
export const thrusterParamsSchema = z.object({
  maxForceNewtons: z.number().finite().positive().default(8),
  energyPerNewtonSecond: z.number().finite().nonnegative().default(0.05),
  baseEnergyPerSecond: z.number().finite().nonnegative().default(0),
});

/** Validated parameters for {@link thrusterActuator}. */
export type ThrusterParams = z.infer<typeof thrusterParamsSchema>;

/**
 * Directional propulsion actuator applying thrust along its hosting part's world forward vector
 * (`cos(angle), sin(angle)`) at the part's world position. When hosted on mirrored visual parts
 * (`thrust.l` / `thrust.r`), asymmetric power produces differential-drive torque on the torso.
 */
export const thrusterActuator = defineActuator({
  id: 'thruster',
  description:
    'Directional propulsion actuator applying force along its mount heading at an energy cost.',
  params: thrusterParamsSchema,
  inputs: {
    power: port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Thrust command in [-1, 1] scaled by maxForceNewtons.',
    }),
  },
  energyCost(params) {
    return {
      basePerSecond: params.baseEnergyPerSecond,
      perUnitEffortPerSecond: params.maxForceNewtons * params.energyPerNewtonSecond,
      perAction: 0,
    };
  },
  create(params, { inputs }) {
    return {
      apply(ctx, input, dt) {
        const power = input.get(inputs.power);
        const forceMag = power * params.maxForceNewtons;
        if (Math.abs(forceMag) > 1e-9) {
          ctx.applyForce(
            {
              x: Math.cos(ctx.worldAngle) * forceMag,
              y: Math.sin(ctx.worldAngle) * forceMag,
            },
            ctx.worldPosition,
          );
        }
        const cost =
          (params.baseEnergyPerSecond + Math.abs(forceMag) * params.energyPerNewtonSecond) * dt;
        if (cost > 0) {
          ctx.consumeEnergy(cost);
        }
      },
    };
  },
});
