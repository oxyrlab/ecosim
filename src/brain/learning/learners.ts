/**
 * Re-exports deterministic, allocation-free learners and neural networks from
 * `@oxyrlab/neuro-learn` (ADR 0008).
 */
export {
  ACTIVATIONS,
  Backpropagator,
  EligibilityTraceLearner,
  FeedforwardNetwork,
  getActivation,
  HebbianLearner,
  MlpSgdLearner,
  RecurrentNetwork,
  RescorlaWagnerLearner,
  type Activation,
  type ActivationId,
  type EligibilityTraceOptions,
  type FeedforwardNetworkOptions,
  type HebbianOptions,
  type Learner,
  type MlpSgdOptions,
  type Network,
  type RecurrentNetworkOptions,
  type RescorlaWagnerOptions,
} from '@oxyrlab/neuro-learn';
