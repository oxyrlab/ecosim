# Guide: Adding a Learning Brain Module

Follow `src/brain/learning/threat-memory.ts` as the canonical template for any new `kind: 'learning'` module.

## Checklist

1. **Create `src/brain/learning/<module-id>.ts` and `<module-id>.test.ts`**:
   - Set `kind: 'learning'` in `defineBrainModule({ ... })`.
   - Declare heritable learning parameters (`learningRate`, `memorySlots`, `forgetRatePerSecond`, etc.) in a Zod schema so `learning-rate-bounds`, `max-memory-slots`, and `max-learner-state-size` validate them automatically.
   - Subscribe to `hormone.reward` and/or `hormone.aversive` ([ADR 0010](../adr/0010-learning-neuromodulators.md)).
2. **Compose allocation-free learners from `@oxyrlab/neuro-learn`**:
   - Pre-allocate all `Float32Array` scratch buffers inside `create()` — zero allocations inside `tick()`.
   - Gate `learner.learn(...)` strictly on active modulator/learning signals and `minLearnIntervalSeconds`.
   - Implement `serialize()` returning a plain JSON-friendly snapshot for Inspector UI and contract tests.
3. **Register & test**:
   - Register the module in `src/brain/index.ts`.
   - Add a contract fixture to `BRAIN_MODULE_FIXTURES` in `tests/contracts/registry-contracts.test.ts` — `runLearningModuleContract` runs automatically for every registered `kind === 'learning'` module!
   - Run `npm run docs:catalog && npm run typecheck && npm run lint && npm run test:coverage && npm run docs:check`.
