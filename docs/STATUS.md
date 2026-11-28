# Project Status

- **Milestone 1 (Phases 0–8):** **Completed** (2026-11-27)
- **Milestone 2 (Visual Overhaul, Organ-Based Reproduction, Allometric Physics & Ecological Benchmarks):** **In Progress** — first 4 workstreams completed and verified (2026-11-28). See [MILESTONE-2.md](MILESTONE-2.md) for full details.
- **Last Updated:** 2026-11-28

## Milestone 2 Progress Summary (2026-11-28)

- **Visual Overhaul (Groups 1–4):** Layered top-down sprites for `rabbit` & `fox`, 6-stage `grass` & `berry-bush`, crisp `fruit`/`corpse`/`rock`, and organic meadow terrain (`src/render/`).
- **Organ-Based Biological Sex:** Added `reproductive-male` / `reproductive-female` organs (`6` organs total) and `reproductive-sensor` (`5` sensors total) with complementary contact enforcement, Inspector readout, and subtle sex marker spots on animals.
- **Physics, Steering & Ecological Calibration:** Allometric `thruster` (`scale²`) and closed-loop `rotator` (`scale⁴` + `angularVelocity` rate control), natural `move → pause → turn` exploration, alignment-gated feeding/hunting, randomized initial energy/age/lifespan/`adultScaleRange`, newborn juvenile sizing (`0.48×`) with live growth sync in `stepAgingSystem`, and `10 sim s = 1 ecological day` metabolic calibration. Fixed shared `actuatorPos` bite-event aliasing and grass runaway flowering.
- **Scenario Registry, UI & Ecological Benchmarks:** Added shared `SCENARIO_PRESETS` (`default-meadow`, `rabbit-starvation-5`, `rabbit-foraging-5`, `rabbit-reproduction-5`, `empty-sandbox`), HUD Scenario Dropdown + `Seed` input / `Random Seed` / `Reset`, and `npm run bench:ecology` (both `rabbit-starvation-5` and `rabbit-foraging-5` passing against biological reference bounds).
- **Current Verification:** `145` test files / `386` tests passing, `format:check`, `typecheck`, `lint`, `docs:check`, `vite build`, and `npm run bench:ecology` all green.

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

- Next Milestone 2 increments (awaiting user direction): wall/boundary perception & avoidance, `seek-mate` brain module driven by `reproductive-sensor`, and additional predator-prey/evolution benchmark scenarios.

## Open Design Questions

- None currently open.

## Open Issues & Technical Debt

- None in Milestone 1 (Phases 0–8).
