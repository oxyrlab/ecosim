# Guide: Add a Brain Module

1. Create `src/brain/modules/<module-id>.ts` (or `src/species/<species-id>/modules/` for species-specific modules) using `defineBrainModule(...)`.
2. Declare all inputs/outputs with `port.analog`, `port.pulse`, or `port.bundle('behavior')`, and optional `publish` / `subscribe` hormones.
3. Never import `World`, `PhysicsAdapter`, or other brain modules—communicate exclusively via `PortReader` and `PortWriter`. Use the injected `rng` for any stochasticity.
4. Add a sibling unit test and verify with `runBrainModuleContract`.
5. Run `npm run docs:catalog && npm run test:coverage && npm run docs:check`.
