# ADR 0005: Top-Down 2D Plane Without Gravity

- **Status:** accepted
- **Date:** 2026-11-25

## Context

EcoSim models ecosystems with predators, prey, herbivores, decomposers, scent gradients, and plants across an open habitat. We must choose a spatial projection that balances behavioral richness with simple shapes, fast physics, and readable observation.

## Decision

Simulate a **top-down 2D horizontal plane with zero gravity**. All creature silhouettes, organs, fields (scent, nutrients, moisture, light), vision cones, and physical forces operate in 2D (`Vec2` in SI meters, angles in radians).

## Rejected options

- **Side-view 2D with gravity:** Restricts spatial exploration, scent gradients, and predator-prey pursuit to a narrow 1D ground line unless complex climbing/flight physics are built.
- **3D simulation:** Multiplies physics, vision, rendering, and authoring complexity far beyond the target scope.

## Consequences

- **Positive:** Natural 2D territory, flocking, pursuit/evasion, scent diffusion, and straightforward compound-shape silhouettes.
- **Negative:** Jumping or elevation effects are modeled abstractly (e.g. collision-layer or impulse modifiers) rather than true vertical trajectories.
