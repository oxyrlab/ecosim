# Simulation Loop & Worker Transport

`src/sim/` drives fixed-timestep execution and Worker RPC with zero DOM or PixiJS dependencies.

## Phase 1 Tick Order (`Simulation.stepFixed`)

1. Drain tick-stamped commands from `CommandQueue` and apply them (`spawn-body`, `remove-entity`, `paint-field`, `apply-impulse`).
2. Step physics (`world.physics.step(fixedTimestepSeconds)`) and drain collision events.
3. Sync ECS `TransformComponent` and `SpatialHash` from physics poses (`world.syncFromPhysics()`).
4. Advance `world.tick` and `world.timeSeconds`.
5. On field diffusion cadence (`physicsRateHz / fieldDiffusionRateHz`, default every 6 ticks at 30 Hz / 5 Hz), step `world.fields.stepDiffusion()`.

_(Additional systems—sensors, bus swap, brain, spine, actuators, metabolism, plants, runtime rules, stats—slot into this pipeline in Phases 2–5.)_

## Worker & Render Snapshots

- `src/sim/worker.ts` exposes `SimWorkerApi` via **Comlink** inside a dedicated Web Worker.
- `buildRenderSnapshot(world)` packs `[id, kind, x, y, angle, size, color]` (`SNAPSHOT_STRIDE = 7` `Float32` values per entity) and transfers `entities.buffer` with zero-copy `Comlink.transfer`.
- `src/render/renderer.ts` renders visible entities via **PixiJS v8** with viewport culling from `src/render/camera.ts` and dispatches user clicks back to the Worker via `enqueueCommand`.
