# ADR 0009: Deterministic Tick-Queued Commands for Interactive Sandbox Editing

- **Status:** accepted
- **Date:** 2026-11-25

## Context

Users should be able to interactively build and experiment with ecosystems—spawning or removing creatures from registered species, painting environmental fields (`soil.nutrients`, `soil.moisture`, `light`), and saving/loading custom scenarios—without breaking Worker separation or simulation determinism.

## Decision

Route every interactive UI mutation (Phase 1 click-to-spawn, Phase 7 Sandbox / World Editor tools, and scenario edits) through a typed `SimCommand` queue (`src/sim/commands.ts`) sent over Comlink to the Worker:

1. Commands are buffered in `CommandQueue` and drained deterministically at the **start of the next fixed tick** before physics and systems execute.
2. Each executed command is stamped with its execution `tick` in `CommandQueue.getHistory()`.
3. Replaying a session requires only `worldSeed` plus the recorded `RecordedCommand[]` log (or exporting a static `ScenarioConfig` JSON snapshot).

## Rejected options

- **Direct main-thread mutation of world state:** Impossible across the Web Worker boundary and violates ADR 0002.
- **Unbuffered immediate mutation mid-tick in the Worker:** Produces timing-dependent non-determinism relative to frame cadence and makes replays impossible.

## Consequences

- **Positive:** Interactive Sandbox editing and strict determinism coexist cleanly from Phase 1 onward.
- **Positive:** Future Phase 7 tools (species spawner, field brushes, obstacle placement, scenario save/load) simply add new `SimCommand` variants without refactoring the Worker or simulation loop.
- **Negative:** User actions take effect on the next fixed tick (at most ~33 ms latency at 30 Hz), which is imperceptible in an ecosystem simulator.
