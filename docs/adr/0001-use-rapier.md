# ADR 0001: Use Rapier 2D (WASM) behind PhysicsAdapter

- **Status:** accepted
- **Date:** 2026-11-25

## Context

EcoSim needs 2D rigid-body physics (compound colliders, revolute/prismatic joints, collision events, raycasts) for ~1,100 simultaneous entities at 30 Hz while keeping simulations deterministic and runnable both in a browser Web Worker and headless in Node.js.

## Decision

Use **Rapier 2D (WASM)** (`@dimforge/rapier2d-deterministic-compat`, falling back to `@dimforge/rapier2d-compat` only if needed) wrapped exclusively inside `src/physics/` behind a `PhysicsAdapter` interface. All other simulation layers interact solely with `PhysicsAdapter` using SI meters and radians.

## Rejected options

- **Matter.js:** JS-only solver with weaker joint stability, lower throughput at 1,000+ bodies, and no cross-platform determinism build.
- **Box2D WASM ports:** Less ergonomic TypeScript packaging and less active maintenance for browser+Node deterministic builds.
- **Custom physics engine:** High engineering cost for compound colliders, joints, and continuous collision events.

## Consequences

- **Positive:** Fast WASM solver, native compound colliders and joints, raycasting, and deterministic mode.
- **Positive:** Isolating Rapier behind `PhysicsAdapter` keeps unit tests mockable and prevents WASM types from leaking across layers.
- **Negative:** Explicit WASM memory management is required (removing bodies/colliders/joints on entity death and calling `world.free()` in teardown, verified by handle-leak tests).
