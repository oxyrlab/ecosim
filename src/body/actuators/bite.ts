import { z } from 'zod';
import { port } from '@bus/ports';
import { defineActuator } from './actuator-def';

/**
 * Zod parameter schema for {@link biteActuator}.
 */
export const biteParamsSchema = z.object({
  damage: z.number().finite().positive().default(12),
  rangeMeters: z.number().finite().positive().default(0.4),
  cooldownSeconds: z.number().finite().nonnegative().default(0.5),
  energyCostPerBite: z.number().finite().nonnegative().default(1.5),
});

/** Validated parameters for {@link biteActuator}. */
export type BiteParams = z.infer<typeof biteParamsSchema>;

/**
 * Discrete feeding/predation actuator triggered by a pulse signal (`trigger > 0.5`).
 * Enforces `cooldownSeconds`, deducts `energyCostPerBite`, and emits a `bite` action event
 * handled by `InteractionSystem` in Phase 3.
 */
export const biteActuator = defineActuator({
  id: 'bite',
  description:
    'Discrete mouth actuator emitting a forward bite action subject to cooldown and energy cost.',
  params: biteParamsSchema,
  inputs: {
    trigger: port.pulse({
      range: [0, 1],
      unit: 'normalized',
      description: 'Pulse > 0.5 fires a bite when off cooldown.',
    }),
  },
  energyCost(params) {
    return {
      basePerSecond: 0,
      perUnitEffortPerSecond: 0,
      perAction: params.energyCostPerBite,
    };
  },
  create(params, { inputs }) {
    let cooldownRemaining = 0;

    return {
      apply(ctx, input, dt) {
        if (cooldownRemaining > 0) {
          cooldownRemaining = Math.max(0, cooldownRemaining - dt);
        }

        const trigger = input.get(inputs.trigger);
        if (trigger > 0.5 && cooldownRemaining <= 0) {
          cooldownRemaining = params.cooldownSeconds;
          if (params.energyCostPerBite > 0) {
            ctx.consumeEnergy(params.energyCostPerBite);
          }
          ctx.emitAction({
            kind: 'bite',
            actorEntityId: ctx.entityId,
            origin: ctx.worldPosition,
            direction: { x: Math.cos(ctx.worldAngle), y: Math.sin(ctx.worldAngle) },
            rangeMeters: params.rangeMeters,
            damage: params.damage,
          });
        }
      },
    };
  },
});
