# World, Grid Fields, and Spatial Hash

`src/world/` owns the non-rendering simulation state (`World`, `FieldSet`, `GridField`, `SpatialHash`, and core ECS components).

## Grid Fields (`GridField` & `FieldSet`)

- Stored on double-buffered `Float32Array`s (`current` and `scratch`), eliminating per-step allocations.
- Default fields (`DEFAULT_FIELD_NAMES`): `scent.plant`, `scent.prey`, `scent.predator`, `scent.corpse`, `pheromone.mate`, `soil.nutrients`, `soil.moisture`, `light`.
- **Mass-conserving diffusion:** 3x3 isotropic kernel (orthogonal `1/6`, diagonal `1/12`) with zero-flux reflective boundaries; verified via `fast-check` property tests in `src/world/field.test.ts`.
- **Bilinear sampling (`sampleBilinear`):** Smooth sub-cell reads for olfactory sensors and gradient estimation.
- **Brush editing (`paintCircle`):** Circular `'set'` / `'add'` brush supporting both scenario initialization and interactive Sandbox editing (Phase 7).

## Spatial Hash (`SpatialHash`)

- Uniform-grid spatial index in meters, independent of Rapier.
- `queryRadius()` and `queryRect()` always return matching `EntityId`s sorted in ascending order for determinism.
- Verified against brute-force Euclidean search via `fast-check`.
