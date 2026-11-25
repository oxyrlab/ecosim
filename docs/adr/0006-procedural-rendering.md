# ADR 0006: Procedural Part-Tree Appearance Separated from Physics

- **Status:** accepted
- **Date:** 2026-11-25

## Context

Creatures grow over their lifecycle, mutate across generations, and display visual cues (size, color, silhouette) that other creatures' vision sensors and learning modules can perceive. Relying on static sprite sheets breaks under continuous growth and morphological mutation.

## Decision

Define creature bodies as a declarative **procedural part tree** (`BodyPartSpec`) built from registered primitive shapes (`circle`, `ellipse`, `rect`, `capsule`, `triangle`, `polygon`, `convex`) positioned in relative parent coordinates:

- **Appearance is decoupled from physics:** parts with `joint: 'visual'` render without adding Rapier colliders or mass (though they may still host sensors/actuators whose forces apply to the nearest physical ancestor).
- Static parts are baked once per appearance signature into cached PixiJS textures and tinted per individual; only animated or jointed parts use separate sprites.
- Visual animations (`swing`, `wag`, `pulse`, `scale`) read bus channel snapshots on the render thread and never affect simulation determinism.

## Rejected options

- **Pre-authored PNG/SVG sprites per species:** Cannot smoothly express morphological mutations or arbitrary jointed chains; duplicates collider definitions.
- **1:1 physics collider per visual part:** Wastes solver budget on purely decorative features (ears, markings, fins).

## Consequences

- **Positive:** Single declarative source of truth for visuals, colliders, growth scaling, and vision appearance features.
- **Negative:** Requires a pure layout solver (`resolveLayout`) and convex decomposition/hull handling for concave shapes.
