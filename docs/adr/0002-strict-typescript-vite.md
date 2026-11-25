# ADR 0002: Strict TypeScript, Vite, and Worker Separation

- **Status:** accepted
- **Date:** 2026-11-25

## Context

EcoSim must maintain a 60 fps browser UI while running 30 Hz simulation ticks and also run faster-than-real-time headless experiments in Node.js. Code must remain legible and safe for incremental AI-assisted extension.

## Decision

Build EcoSim in **strict TypeScript** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no `any`, named exports only) bundled with **Vite**. Separate simulation (`src/sim/` and lower layers) strictly from rendering (`src/render/`, `src/ui/`):

- Simulation has zero DOM or PixiJS dependencies and runs inside a Web Worker (communicating via Comlink and compact Transferable TypedArray snapshots) or directly in Node.js (`src/headless/`).
- Determinism is lint-enforced by banning `Math.random()`, `Date.now()`, and `performance.now()` in all simulation layers.

## Rejected options

- **Main-thread simulation loop:** Heavy ticks or field diffusion would stall rendering and UI responsiveness.
- **Loose TypeScript / JavaScript:** Increases silent NaN, undefined-index, and wiring contract bugs across modules.

## Consequences

- **Positive:** Smooth rendering decoupled from simulation tick time; identical code runs in browser Workers and Node.js scenario tests.
- **Negative:** Main-thread rendering and Inspector UI must read snapshots/RPC data rather than mutating simulation objects directly.
