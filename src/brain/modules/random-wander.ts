import { z } from 'zod';
import { port, type PortHandle } from '@bus/ports';
import { defineBrainModule } from '../module-def';

/**
 * Zod parameter schema for {@link randomWanderModule}.
 */
export const randomWanderParamsSchema = z.object({
  baseUrgency: z.number().finite().min(0).max(1).default(0.2),
  cruiseSpeed: z.number().finite().min(0).max(1).default(0.32),
  maxTurnRate: z.number().finite().min(0).max(1).default(0.55),
  turnIntervalSeconds: z.number().finite().positive().default(1.8),
  minPauseSeconds: z.number().finite().nonnegative().default(0.55),
  maxPauseSeconds: z.number().finite().nonnegative().default(1.4),
  minTurnSeconds: z.number().finite().positive().default(0.5),
  maxTurnSeconds: z.number().finite().positive().default(1.15),
});

/** Validated parameters for {@link randomWanderModule}. */
export type RandomWanderParams = z.infer<typeof randomWanderParamsSchema>;

type WanderPhase = 'move' | 'pause' | 'turn';

/**
 * Shared baseline exploration module producing naturalistic animal exploration cycles:
 * straight cruising bursts (`move`), brief scanning stops (`pause`), and smooth finite heading
 * adjustments (`turn`) driven deterministically from the creature's seeded `Rng`.
 */
export const randomWanderModule = defineBrainModule({
  id: 'random-wander',
  kind: 'rule',
  description:
    'Generates deterministic naturalistic move-pause-turn exploration steering using the entity seeded RNG.',
  params: randomWanderParamsSchema,
  inputs: {},
  outputs: {
    ...port.bundle('behavior'),
  },
  create(params, { outputs }, rng) {
    const urgencyH = outputs.urgency as PortHandle;
    const turnH = outputs.turn as PortHandle;
    const forwardH = outputs.forward as PortHandle;

    const minPause = Math.min(params.minPauseSeconds, params.maxPauseSeconds);
    const maxPause = Math.max(params.minPauseSeconds, params.maxPauseSeconds);
    const minTurn = Math.min(params.minTurnSeconds, params.maxTurnSeconds);
    const maxTurn = Math.max(params.minTurnSeconds, params.maxTurnSeconds);

    let phase: WanderPhase = 'move';
    let remainingSeconds = params.turnIntervalSeconds * (0.65 + rng.next() * 0.7);
    let currentTurn = (rng.next() * 2 - 1) * 0.08;
    let currentForward = params.cruiseSpeed;

    const enterPhase = (nextPhase: WanderPhase): void => {
      phase = nextPhase;
      if (nextPhase === 'move') {
        remainingSeconds = params.turnIntervalSeconds * (0.7 + rng.next() * 0.85);
        currentTurn = (rng.next() * 2 - 1) * Math.min(0.1, params.maxTurnRate * 0.2);
        currentForward = params.cruiseSpeed * (0.82 + rng.next() * 0.36);
      } else if (nextPhase === 'pause') {
        remainingSeconds = minPause + rng.next() * (maxPause - minPause);
        currentTurn = 0;
        currentForward = 0;
      } else {
        remainingSeconds = minTurn + rng.next() * (maxTurn - minTurn);
        const dir = rng.next() < 0.5 ? -1 : 1;
        const mag = (0.45 + rng.next() * 0.55) * params.maxTurnRate;
        currentTurn = dir * mag;
        currentForward = params.cruiseSpeed * 0.25;
      }
    };

    return {
      tick(_input, output, dt) {
        remainingSeconds -= dt;
        if (remainingSeconds <= 0) {
          if (phase === 'move') {
            enterPhase(maxPause > 0 ? 'pause' : 'turn');
          } else if (phase === 'pause') {
            enterPhase('turn');
          } else {
            enterPhase('move');
          }
        }
        output.set(urgencyH, params.baseUrgency);
        output.set(turnH, currentTurn);
        output.set(forwardH, currentForward);
      },
      serialize() {
        return { phase, remainingSeconds, currentTurn, currentForward };
      },
    };
  },
});
