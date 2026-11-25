# ADR 0008: In-House Learning Core Without External ML Frameworks

- **Status:** accepted
- **Date:** 2026-11-25

## Context

Phase 6 introduces associative and online learning modules (such as `threat-memory` using Rescorla-Wagner conditioning and eligibility traces, Hebbian updates, and small online MLPs) running independently inside hundreds of creatures per tick. Every learner must be deterministic, allocation-free after creation, bounded in state size, serializable, and fast on CPU inside a Web Worker or Node.js.

## Decision

1. **In-house implementation only:** Implement all learning algorithms and small neural networks in-house on fixed-size `Float32Array` buffers—built as our standalone, zero-dependency core package `@oxyrlab/neuro-learn` (`../neuro-learn`) and integrated into `src/brain/learning` and `src/brain/nn` in Phase 6.
2. **No external ML library and no multi-backend adapter in this phase:** Do not include TensorFlow.js, ONNX Runtime, WebGPU ML frameworks, or an abstract multi-backend adapter layer. The required algorithms are small tight loops over `Float32Array` where JS/V8 outperforms tensor-dispatch overhead by orders of magnitude while remaining 100% deterministic.
3. **Learned state is never inherited:** Offspring always start with empty learned memory. Only learning _parameters_ (learning rate, memory slot count, forgetting rate) live in the Blueprint genome and mutate across generations.
4. **Future extensibility via `Learner`:** An external ML library may be reconsidered in a future phase _only_ if a specific module genuinely requires large networks, and _only_ by implementing the `Learner` interface (`stateSize`, `predict`, `learn`, `decay`, `serialize`, `restore`) without altering the surrounding brain or bus architecture.

## Rejected options

- **TensorFlow.js:** Heavy bundle size, tensor allocation/disposal overhead on tiny per-creature networks, and non-deterministic GPU kernels.
- **Multi-backend ML adapter upfront:** Speculative abstraction for a single in-house CPU backend; adds indirection and testing surface with zero current benefit.
- **Lamarckian inheritance of learned weights:** Collapses the distinction between evolutionary adaptation and lifetime learning and inflates genome serialization.

## Consequences

- **Positive:** Zero external ML dependencies, deterministic cross-platform math, zero hot-loop allocations, full numerical gradient checks, and trivial snapshot serialization.
- **Positive:** `@oxyrlab/neuro-learn` is already implemented and verified at `v0.1.0` with an identical `Rng` contract (`next(): number`).
- **Negative:** Very large deep networks (thousands of parameters per creature) are out of scope for this phase, which is consistent with the ecosystem performance budget.
