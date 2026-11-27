# Lifetime Learning & Neural Modules

Lifetime learning and compact neural networks are powered by `@oxyrlab/neuro-learn` (`src/brain/learning/`, `src/brain/nn/`) with zero external ML framework dependencies ([ADR 0008](../adr/0008-in-house-learning.md)).

## Core Principles

1. **In-house `Float32Array` learners**: `RescorlaWagnerLearner`, `EligibilityTraceLearner`, `HebbianLearner`, `MlpSgdLearner`, and `FeedforwardNetwork` / `RecurrentNetwork` allocate fixed buffers at creation and zero objects in hot loops.
2. **Modulator-gated updates ([ADR 0010](../adr/0010-learning-neuromodulators.md))**: learning updates are triggered only by short-lived normalized neuromodulators (`hormone.reward` on feeding/reproduction, `hormone.aversive` on damage/starvation) or direct `pain` pulses — never unconditionally every tick.
3. **Learned memory is not inherited**: offspring inherit heritable learning parameters (`learningRate`, `memorySlots`, `forgetRatePerSecond`) through `src/genome/`, but start every life with empty associative memory.
4. **Appearance-based perception**: `vision-sensor` (`features: true`) publishes 5 normalized `[0, 1]` appearance features (`nearest.size`, `nearest.hue`, `nearest.lightness`, `nearest.shape`, `nearest.parts`) computed by `extractAppearanceFeatures` (`src/appearance/features.ts`) so creatures learn from _what others look like_ rather than species IDs or tags.

## Built-in Phase 6 Modules

- **`threat-memory`** (`src/brain/learning/threat-memory.ts`, `kind: 'learning'`): associates appearance prototypes with aversive events via `EligibilityTraceLearner` + RBF generalization. Supports conditioning, smooth generalization to visually similar creatures, and natural extinction on repeated safe sightings.
- **`nn-controller`** (`src/brain/nn/nn-module.ts`, `kind: 'nn'`): evolvable feedforward controller backed by `FeedforwardNetwork` with serializable/mutable weights.

## Learning Constraint Rules

See [Constraint Rules Catalog](../catalog/rules.md): `max-learner-state-size`, `max-memory-slots`, `learning-rate-bounds`, and `learning-max-updates-per-second`.
