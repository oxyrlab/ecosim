import { z } from 'zod';
import { port, type PortHandle } from '@bus/ports';
import { defineBrainModule } from '../module-def';

/**
 * Zod parameter schema for {@link randomWanderModule}.
 */
export const randomWanderParamsSchema = z.object({
  baseUrgency: z.number().finite().min(0).max(1).default(0.2),
  cruiseSpeed: z.number().finite().min(0).max(1).default(0.45),
  maxTurnRate: z.number().finite().min(0).max(1).default(0.6),
  turnIntervalSeconds: z.number().finite().positive().default(1.8),
});

/** Validated parameters for {@link randomWanderModule}. */
export type RandomWanderParams = z.infer<typeof randomWanderParamsSchema>;

/**
 * Shared baseline exploration module generating smooth deterministic wandering turns from the
 * creature's seeded `Rng` so animals explore when neither hungry nor fleeing.
 */
export const randomWanderModule = defineBrainModule({
  id: 'random-wander',
  kind: 'rule',
  description:
    'Generates deterministic low-priority wandering steering using the entity seeded RNG.',
  params: randomWanderParamsSchema,
  inputs: {},
  outputs: {
    ...port.bundle('behavior'),
  },
  create(params, { outputs }, rng) {
    const urgencyH = outputs.urgency as PortHandle;
    const turnH = outputs.turn as PortHandle;
    const forwardH = outputs.forward as PortHandle;

    let elapsed = params.turnIntervalSeconds;
    let currentTurn = 0;

    return {
      tick(_input, output, dt) {
        elapsed += dt;
        if (elapsed >= params.turnIntervalSeconds) {
          elapsed -= params.turnIntervalSeconds;
          currentTurn = (rng.next() * 2 - 1) * params.maxTurnRate;
        }
        output.set(urgencyH, params.baseUrgency);
        output.set(turnH, currentTurn);
        output.set(forwardH, params.cruiseSpeed);
      },
      serialize() {
        return { elapsed, currentTurn };
      },
    };
  },
});
