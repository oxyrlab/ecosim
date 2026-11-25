# ADR 0004: Double-Buffered SignalBus with Static Wiring and Hormones

- **Status:** accepted
- **Date:** 2026-11-25

## Context

Every animal has an isolated nervous system composed of sensors, brain modules, and a spine. Modules must never access each other or the World directly, must produce deterministic results independent of module execution order, and must run without per-tick object allocation or string lookups.

## Decision

Give each animal its own **double-buffered `SignalBus`** backed by two `Float32Array` buffers (`current` and `next`):

- Reads come from `current`, writes go to `next`, and `swap()` runs at a fixed point in the simulation loop (creating a natural one-tick neural delay).
- Point-to-point **wiring** (`"<instanceId>:<port>"`, fan-out, explicitly merged fan-in, and named port bundles) is static data in the Blueprint resolved to numeric handles once at spawn time.
- Shared **hormone channels** provide broadcast pub/sub (including neuromodulators for learning), also pre-resolved to numeric indices at spawn time.

## Rejected options

- **Direct method calls / EventEmitter pub-sub:** Creates GC pressure, introduces execution-order sensitivity, and couples modules together.
- **Single-buffer shared array:** Makes brain behavior depend on module evaluation order within a tick.

## Consequences

- **Positive:** Zero allocations and zero string lookups in the hot loop; strict module isolation; wiring becomes evolvable genome data.
- **Negative:** Signals incur a 1-tick delay across each bus hop (biologically plausible and deterministic, but must be accounted for in reflexes and integration tests).
