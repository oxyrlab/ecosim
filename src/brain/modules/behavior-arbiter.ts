import { z } from 'zod';
import { port, type PortDef, type PortHandle, type PortMap } from '@bus/ports';
import { defineBrainModule } from '../module-def';

/**
 * Zod parameter schema for {@link behaviorArbiterModule}.
 */
export const behaviorArbiterParamsSchema = z.object({
  slots: z.array(z.string().min(1)).min(1).default(['flee', 'forage', 'wander']),
  weights: z.record(z.string(), z.number().finite().positive()).default({}),
});

/** Validated parameters for {@link behaviorArbiterModule}. */
export type BehaviorArbiterParams = z.infer<typeof behaviorArbiterParamsSchema>;

/**
 * Shared priority arbiter selecting the winning named `behavior` slot (`urgency`, `turn`,
 * `forward`) by highest weighted urgency and forwarding its locomotion + bite commands to the
 * creature's spine (Section 5.2.1 & Phase 5).
 */
export const behaviorArbiterModule = defineBrainModule({
  id: 'behavior-arbiter',
  kind: 'utility',
  description:
    'Selects the highest-urgency named behavior bundle slot and emits move.forward, move.turn, and action.bite.',
  params: behaviorArbiterParamsSchema,
  inputs(params): PortMap {
    const out: Record<string, PortDef> = {
      'bite.in': port.pulse({
        range: [0, 1],
        unit: 'normalized',
        merge: 'max',
        description: 'Merged bite request pulse from foraging or hunting modules.',
      }),
    };
    for (const slot of params.slots) {
      Object.assign(out, port.bundle('behavior', slot));
    }
    return out;
  },
  outputs: {
    'move.forward': port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Winning behavior forward command.',
    }),
    'move.turn': port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Winning behavior steering command.',
    }),
    'action.bite': port.pulse({
      range: [0, 1],
      unit: 'normalized',
      description: 'Forwarded bite pulse for the spine.',
    }),
  },
  create(params, { inputs, outputs }) {
    const slotHandles = params.slots.map((slot) => ({
      weight: params.weights[slot] ?? 1,
      urgency: inputs[`${slot}.urgency`] as PortHandle,
      turn: inputs[`${slot}.turn`] as PortHandle,
      forward: inputs[`${slot}.forward`] as PortHandle,
    }));
    const biteInH = inputs['bite.in'] as PortHandle;
    const moveFwdH = outputs['move.forward'] as PortHandle;
    const moveTurnH = outputs['move.turn'] as PortHandle;
    const actionBiteH = outputs['action.bite'] as PortHandle;

    let activeSlot = 0;

    return {
      tick(input, output) {
        let bestScore = -1;
        let bestIdx = 0;
        for (let i = 0; i < slotHandles.length; i += 1) {
          const s = slotHandles[i] as (typeof slotHandles)[number];
          const score = input.get(s.urgency) * s.weight;
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
        activeSlot = bestIdx;
        const winner = slotHandles[bestIdx] as (typeof slotHandles)[number];
        output.set(moveFwdH, input.get(winner.forward));
        output.set(moveTurnH, input.get(winner.turn));
        output.set(actionBiteH, input.get(biteInH));
      },
      serialize() {
        return { activeSlot: params.slots[activeSlot] ?? null };
      },
    };
  },
});
