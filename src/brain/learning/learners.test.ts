import { describe, expect, it } from 'vitest';
import { runLearnerContract } from '@oxyrlab/neuro-learn/testing';
import { createSeededRng } from '@core/index';
import {
  Backpropagator,
  EligibilityTraceLearner,
  FeedforwardNetwork,
  HebbianLearner,
  MlpSgdLearner,
  RescorlaWagnerLearner,
} from './learners';

runLearnerContract(
  'RescorlaWagnerLearner',
  () => new RescorlaWagnerLearner({ inputSize: 4, outputSize: 2, forgetRatePerSecond: 0.2 }),
  { maxAbsState: 1 },
);

runLearnerContract(
  'EligibilityTraceLearner',
  () =>
    new EligibilityTraceLearner({
      inputSize: 4,
      outputSize: 2,
      traceTimeConstantSeconds: 1.5,
      forgetRatePerSecond: 0.2,
    }),
  { maxAbsState: 1 },
);

runLearnerContract(
  'HebbianLearner',
  () => new HebbianLearner({ inputSize: 4, outputSize: 2, forgetRatePerSecond: 0.2 }),
  { maxAbsState: 1 },
);

runLearnerContract(
  'MlpSgdLearner',
  () =>
    new MlpSgdLearner({
      layerSizes: [4, 5, 2],
      rng: createSeededRng(7),
      forgetRatePerSecond: 0.2,
      maxWeight: 5,
    }),
  { maxAbsState: 5, initialState: 'zero-prediction' },
);

describe('mlp-sgd numerical gradient check (Section 9.3)', () => {
  it('matches analytic backpropagation gradients against central finite differences within tolerance', () => {
    const net = new FeedforwardNetwork({
      layerSizes: [3, 4, 2],
      rng: createSeededRng(123),
      hiddenActivation: 'tanh',
      outputActivation: 'linear',
    });
    const backprop = new Backpropagator(net);
    const input = Float32Array.of(0.4, -0.7, 0.25);
    const target = Float32Array.of(0.8, -0.3);
    const out = new Float32Array(2);
    const analytic = new Float32Array(net.weights.length);

    const computeLoss = (): number => {
      net.forward(input, out);
      let loss = 0;
      for (let i = 0; i < out.length; i += 1) {
        const diff = (out[i] as number) - (target[i] as number);
        loss += 0.5 * diff * diff;
      }
      return loss;
    };

    net.forward(input, out);
    backprop.computeGradient(target, analytic);

    const eps = 1e-3;
    for (let w = 0; w < net.weights.length; w += 1) {
      const orig = net.weights[w] as number;
      net.weights[w] = orig + eps;
      const lossPlus = computeLoss();
      net.weights[w] = orig - eps;
      const lossMinus = computeLoss();
      net.weights[w] = orig;

      const numeric = (lossPlus - lossMinus) / (2 * eps);
      expect(analytic[w] as number).toBeCloseTo(numeric, 2);
    }
  });
});
