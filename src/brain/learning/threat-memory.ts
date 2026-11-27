import { z } from 'zod';
import { EligibilityTraceLearner } from '@oxyrlab/neuro-learn';
import { port, type PortDef, type PortHandle } from '@bus/ports';
import { clamp } from '@core/index';
import { defineBrainModule } from '../module-def';

const FEATURE_DIM = 5;

/**
 * Zod parameter schema for {@link threatMemoryModule} (Section 5.3.1).
 * Learning parameters (`learningRate`, `memorySlots`, `forgetRatePerSecond`, etc.) are genes
 * validated by Constraint Rules (`learning-rate-bounds`, `max-memory-slots`, `max-learner-state-size`).
 */
export const threatMemoryParamsSchema = z.object({
  learningRate: z.number().finite().positive().max(1).default(0.38),
  extinctionRate: z.number().finite().min(0).max(1).default(0.08),
  memorySlots: z.number().int().min(1).max(64).default(8),
  traceTimeConstantSeconds: z.number().finite().positive().default(2.5),
  forgetRatePerSecond: z.number().finite().nonnegative().default(0.002),
  generalizationSigma: z.number().finite().positive().default(0.28),
  noveltyThreshold: z.number().finite().min(0.1).max(0.99).default(0.8),
  minLearnIntervalSeconds: z.number().finite().nonnegative().default(0.25),
  escapeSpeed: z.number().finite().min(0.2).max(1).default(1.0),
});

/** Validated parameters for {@link threatMemoryModule}. */
export type ThreatMemoryParams = z.infer<typeof threatMemoryParamsSchema>;

/**
 * Associative fear-conditioning learning module (`kind: 'learning'`, amygdala analogue —
 * Section 5.3.1 & ADR 0010).
 *
 * Associates 5-D visual appearance patterns (`size`, `hue`, `lightness`, `shape`, `parts`) with
 * aversive outcomes (`pain` pulse or `hormone.aversive`) via `EligibilityTraceLearner` and
 * Rescorla–Wagner delta updates, supporting:
 * - Delayed credit assignment (see creature, then get bitten)
 * - Extinction on repeated safe sightings without pain
 * - Smooth generalization to visually similar creatures via RBF similarity
 * - Zero allocations in `tick()`, fixed state size, and empty initial memory on offspring.
 */
export const threatMemoryModule = defineBrainModule({
  id: 'threat-memory',
  kind: 'learning',
  description:
    'Modulator-gated fear conditioning associating visual appearance features with pain/aversive signals.',
  params: threatMemoryParamsSchema,
  inputs: {
    'nearest.seen': port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Visual proximity of nearest creature with appearance features.',
    }),
    'nearest.dir': port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Visual bearing of nearest creature (-1 left, +1 right).',
    }),
    'nearest.size': port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Normalized size feature of nearest creature.',
    }),
    'nearest.hue': port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Normalized hue feature of nearest creature.',
    }),
    'nearest.lightness': port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Normalized lightness feature of nearest creature.',
    }),
    'nearest.shape': port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Normalized dominant shape code of nearest creature.',
    }),
    'nearest.parts': port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Normalized part count feature of nearest creature.',
    }),
    pain: port.pulse({
      range: [0, 1],
      unit: 'normalized',
      description: 'Direct pain pulse from pain-sensor.',
    }),
  },
  outputs: {
    predictedDanger: port.analog({
      range: [0, 1],
      unit: 'normalized',
      description: 'Learned threat level associated with the currently viewed appearance [0, 1].',
    }),
    dangerTurn: port.analog({
      range: [-1, 1],
      unit: 'normalized',
      description: 'Steering turn away from a learned threat [-1, 1].',
    }),
    ...port.bundle('behavior'),
  } as Readonly<Record<string, PortDef>>,
  subscribe: ['hormone.aversive'],
  create(params, { inputs, outputs, subscribe }) {
    const slots = params.memorySlots;
    const prototypes = new Float32Array(slots * FEATURE_DIM);
    const slotUsed = new Uint8Array(slots);
    const obsBuf = new Float32Array(FEATURE_DIM);
    const lastObsBuf = new Float32Array(FEATURE_DIM);
    const cueBuf = new Float32Array(slots);
    const predBuf = new Float32Array(1);
    const targetOne = Float32Array.of(1);
    const targetZero = Float32Array.of(0);

    const learner = new EligibilityTraceLearner({
      inputSize: slots,
      outputSize: 1,
      traceTimeConstantSeconds: params.traceTimeConstantSeconds,
      maxStrength: 1,
      forgetRatePerSecond: params.forgetRatePerSecond,
    });

    const invTwoSigmaSq = 1 / (2 * params.generalizationSigma * params.generalizationSigma);

    const seenH = inputs['nearest.seen'] as PortHandle;
    const dirH = inputs['nearest.dir'] as PortHandle;
    const sizeH = inputs['nearest.size'] as PortHandle;
    const hueH = inputs['nearest.hue'] as PortHandle;
    const lightH = inputs['nearest.lightness'] as PortHandle;
    const shapeH = inputs['nearest.shape'] as PortHandle;
    const partsH = inputs['nearest.parts'] as PortHandle;
    const painH = inputs.pain as PortHandle;
    const aversiveH = subscribe['hormone.aversive'];

    const dangerH = outputs['predictedDanger'] as PortHandle;
    const dangerTurnH = outputs['dangerTurn'] as PortHandle;
    const urgencyH = outputs['urgency'] as PortHandle;
    const turnH = outputs['turn'] as PortHandle;
    const forwardH = outputs['forward'] as PortHandle;

    let hasRecentObs = false;
    let timeSinceObs = Number.POSITIVE_INFINITY;
    let learnCooldown = 0;
    let extinctionCooldown = 0;
    let totalLearnUpdates = 0;
    let lastAwayTurn = 0;

    const computeCueActivations = (features: Float32Array, outCues: Float32Array): number => {
      let bestSim = 0;
      for (let s = 0; s < slots; s += 1) {
        if (slotUsed[s] === 0) {
          outCues[s] = 0;
          continue;
        }
        const base = s * FEATURE_DIM;
        let distSq = 0;
        for (let f = 0; f < FEATURE_DIM; f += 1) {
          const diff = (features[f] as number) - (prototypes[base + f] as number);
          distSq += diff * diff;
        }
        const sim = Math.exp(-distSq * invTwoSigmaSq);
        outCues[s] = sim;
        if (sim > bestSim) bestSim = sim;
      }
      return bestSim;
    };

    const allocateSlot = (features: Float32Array): number => {
      for (let s = 0; s < slots; s += 1) {
        if (slotUsed[s] === 0) {
          slotUsed[s] = 1;
          prototypes.set(features, s * FEATURE_DIM);
          return s;
        }
      }
      // Replace slot with lowest learned strength when full
      const state = learner.serialize();
      let minIdx = 0;
      let minStrength = Math.abs(state[0] as number);
      for (let s = 1; s < slots; s += 1) {
        const mag = Math.abs(state[s] as number);
        if (mag < minStrength) {
          minStrength = mag;
          minIdx = s;
        }
      }
      prototypes.set(features, minIdx * FEATURE_DIM);
      return minIdx;
    };

    return {
      tick(input, output, dt) {
        learner.decay(dt);
        if (learnCooldown > 0) learnCooldown = Math.max(0, learnCooldown - dt);
        if (extinctionCooldown > 0) extinctionCooldown = Math.max(0, extinctionCooldown - dt);
        timeSinceObs += dt;

        const seen = input.get(seenH);
        const dir = input.get(dirH);
        const pain = input.get(painH);
        const aversiveHormone = aversiveH !== undefined ? input.get(aversiveH) : 0;
        const aversive = Math.max(pain, aversiveHormone);

        let predictedDanger = 0;

        if (seen > 0.02) {
          obsBuf[0] = input.get(sizeH);
          obsBuf[1] = input.get(hueH);
          obsBuf[2] = input.get(lightH);
          obsBuf[3] = input.get(shapeH);
          obsBuf[4] = input.get(partsH);
          lastObsBuf.set(obsBuf);
          hasRecentObs = true;
          timeSinceObs = 0;
          lastAwayTurn = dir >= 0 ? -1 : 1;

          computeCueActivations(obsBuf, cueBuf);
          learner.observe(cueBuf);
          learner.predict(cueBuf, predBuf);
          predictedDanger = clamp(predBuf[0] as number, 0, 1);
        }

        // Modulator-gated associative conditioning (ADR 0010)
        if (
          aversive > 0.05 &&
          learnCooldown <= 0 &&
          hasRecentObs &&
          timeSinceObs <= params.traceTimeConstantSeconds * 2
        ) {
          const bestSim = computeCueActivations(lastObsBuf, cueBuf);
          if (bestSim < params.noveltyThreshold) {
            allocateSlot(lastObsBuf);
            computeCueActivations(lastObsBuf, cueBuf);
          }
          const effectiveRate = clamp(params.learningRate * clamp(aversive, 0.5, 1), 0, 1);
          learner.learn(cueBuf, targetOne, effectiveRate);
          learnCooldown = params.minLearnIntervalSeconds;
          totalLearnUpdates += 1;

          if (seen > 0.02) {
            learner.predict(cueBuf, predBuf);
            predictedDanger = clamp(predBuf[0] as number, 0, 1);
          }
        } else if (
          seen > 0.02 &&
          predictedDanger > 0.01 &&
          params.extinctionRate > 0 &&
          extinctionCooldown <= 0
        ) {
          // Safe sighting without pain weakens association (extinction)
          learner.learn(cueBuf, targetZero, params.extinctionRate);
          extinctionCooldown = params.minLearnIntervalSeconds;
          totalLearnUpdates += 1;
        }

        const turnCmd = predictedDanger > 0.08 ? lastAwayTurn : 0;
        const forwardCmd = predictedDanger > 0.08 ? params.escapeSpeed : 0;

        output.set(dangerH, predictedDanger);
        output.set(dangerTurnH, turnCmd);
        output.set(urgencyH, predictedDanger);
        output.set(turnH, turnCmd);
        output.set(forwardH, forwardCmd);
      },
      serialize() {
        return {
          memorySlots: slots,
          usedSlots: Array.from(slotUsed),
          prototypes: Array.from(prototypes),
          learnerState: Array.from(learner.serialize()),
          totalLearnUpdates,
        };
      },
    };
  },
});
