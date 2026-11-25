# Creature Appearance

Creatures are rendered procedurally from a declarative **part tree** (`BodyPartSpec`) seen from top-down ([ADR 0005](../adr/0005-top-down-view.md), [ADR 0006](../adr/0006-procedural-rendering.md)).

## Core Concepts

- **Primitive shapes (`src/appearance/shapes/`):** `circle`, `ellipse`, `rect`, `capsule`, `triangle`, `polygon`, `convex`. See [docs/catalog/shapes.md](../catalog/shapes.md).
- **Relative coordinates:** Every child part attaches at `at` (normalized `[-1, 1]` on the parent's bounding box or keyword `'front' | 'back' | 'left' | 'right' | 'center'`) using its own `pivot`. Scaling the creature by `scale(age)` preserves proportions automatically.
- **Mirroring (`mirror: true`):** Expands a part into `<id>.l` and `<id>.r`, mirroring `at.y`, `pivot.y`, `angle`, and hosted sensor/actuator instance ids (`thrust` → `thrust.l` / `thrust.r`).
- **Physics decoupling:**
  - `joint: 'fixed'` (default): physical collider attached to its physical parent's compound RigidBody.
  - `joint: 'visual'`: zero collider and zero mass; any hosted actuator applies force to `physicalAncestorId`.
  - `joint: { type: 'revolute' | 'prismatic', limits? }`: creates a new jointed RigidBody.
- **Concave shapes:** Handled via `ConcaveStrategy` (`'reject'`, `'hull'`, `'decompose'`) governed by Rule `collider-concave-strategy`.
- **Caching & animations:** `AppearanceTextureCache` (`src/render/texture-cache.ts`) bakes static non-animated parts once per `appearanceSignature`; animated or jointed parts render dynamically via `evaluatePartAnimations()` (`swing`, `wag`, `pulse`, `scale`), reading snapshot channels without affecting determinism.
