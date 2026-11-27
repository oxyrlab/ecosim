# Project Status

- **Milestone 1 (Phases 0–8):** **Completed** (2026-11-27)
- **Current Stage:** Ready for **Milestone 2** — see [MILESTONE-2.md](MILESTONE-2.md) for the full technical baseline, invariants, extension points, and upcoming roadmap space.
- **Last Updated:** 2026-11-27

## Milestone 1 Completion Summary (Phases 0–8)

All foundational phases from the initial specification are complete and verified:

- **Phases 0–7:** Infrastructure, deterministic Rapier 2D physics & grid fields, procedural appearance, double-buffered `SignalBus` & modular nervous system, metabolism & `EnergyLedger`, full plant lifecycle, first 4-species ecosystem (`grass`, `berry-bush`, `rabbit`, `fox`), evolution/reproduction & `@oxyrlab/neuro-learn` learning (ADR 0010), live Observation HUD, deterministic Interactive Sandbox (ADR 0009), and Headless CLI runner.
- **Phase 8 (Optimization & Procedural Canvas Rendering):**
  - Added reproducible scale & micro-benchmark runner (`scripts/bench-scale.ts`, `npm run bench`) and deterministic scale stress test (`tests/scenarios/scale-budget.test.ts`).
  - Optimized `SpatialHash` (`4.15 ms → 1.20 ms`, **3.46× faster**), skipped fixed bodies in `syncFromPhysics()`, eliminated per-creature closures and per-plant coordinate allocations, and enforced staggered sensor `sampleRateHz` while keeping brain modules ticking every tick for lossless pulse chains.
  - Reduced target-scale mean tick time (500 animals + 500 plants + 100 objects, real Rapier WASM) from **`18.86 ms`** to **`8.00 ms`** (`min 7.00 ms`), meeting the Section 7 `<= 8 ms` budget without altering Constraint Rule defaults.
  - Connected Phase 1.5 procedural species shapes (`src/render/species-shapes.ts`) and `AppearanceTextureCache` + pooled PixiJS `Sprite`s directly to `EcoSimRenderer`.
- **Final Milestone 1 Verification:** `138` test files / `375` tests passing (`98.29%` Stmts, `92.92%` Branch, `99.10%` Funcs, `99.20%` Lines), `format:check`, `typecheck`, `lint`, `docs:check`, `vite build`, and `npm run bench` all green.

## Exact Next Task

- Capture user requirements and next-stage phases in [MILESTONE-2.md](MILESTONE-2.md) before beginning Milestone 2 implementation.

## Open Design Questions

- None currently open.

## Open Issues & Technical Debt

- None in Milestone 1 (Phases 0–8).
