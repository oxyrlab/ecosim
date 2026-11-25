# Physics Architecture (Rapier 2D)

All physics runs through `@dimforge/rapier2d-deterministic-compat` exclusively inside `src/physics/`, behind the `PhysicsAdapter` interface ([ADR 0001](../adr/0001-use-rapier.md)).

## Key Invariants

- **Single import boundary:** Only `src/physics/rapier-init.ts` and `src/physics/rapier-adapter.ts` import Rapier. Higher layers target `PhysicsAdapter` (`src/physics/types.ts`).
- **Zero-gravity top-down plane:** `new RAPIER.World({ x: 0, y: 0 })` in SI meters and radians ([ADR 0005](../adr/0005-top-down-view.md)).
- **Idempotent WASM boot:** Call `await initRapier()` (or `await createRapierPhysicsAdapter()`) once at Worker, Node, or test startup.
- **Collision groups:** 16-bit membership/filter bitmasks (`COLLISION_GROUP.CREATURE`, `PLANT`, `FRUIT`, `WALL`, `ALL`).
- **Events:** Collected via `RAPIER.EventQueue` during `step(dt)` and exposed via `drainCollisionEvents()` so domain logic stays out of `src/physics/`.
- **WASM memory safety:** `removeBody()` removes attached colliders and joints; `free()` destroys both `EventQueue` and `RAPIER.World`. Verified by handle-leak tests in `src/physics/rapier-adapter.test.ts`.
- **Mock adapter:** `createMockPhysicsAdapter()` provides a pure-JS deterministic implementation for fast unit tests of non-physics systems.
