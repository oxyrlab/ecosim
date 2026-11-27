# EcoSim Documentation

## Project Summary

EcoSim is a deterministic 2D browser-based ecosystem simulator targeting ~500 animals, ~500 plants, and ~100 other objects (fruit, seeds, corpses) at 30 Hz physics and 60 fps rendering.
Every animal runs an isolated nervous system: physical body, organs, sensors, a double-buffered `Float32Array` `SignalBus`, modular brain components, a species-specific spine, and actuators.
Brain modules communicate solely via declared bus ports and broadcast hormone channels—never directly with each other or the World.
Physics runs via deterministic Rapier 2D (WASM) behind a `PhysicsAdapter`, while grid fields handle scent, soil nutrients, moisture, and light.
Simulation layers are decoupled from rendering (PixiJS v8) and run headless in Node.js or in a browser Web Worker, accepting tick-queued Sandbox commands for reproducible interactive editing.
All numeric caps and floors are expressed as configurable Constraint Rules (`src/rules/`) with documented rationales rather than hard-coded constants.
In-house learning algorithms and compact neural networks are supplied by `@oxyrlab/neuro-learn` without TensorFlow.js.

## Start Here

- [Current Status & Next Task](STATUS.md)
- [Milestone 2 Handoff & Baseline](MILESTONE-2.md)
- [Glossary](glossary.md)
- [Changelog](CHANGELOG.md)
- [ADR Index](#architecture-decision-records)

## Reading Order by Task Type

| Task                                          | Read in Order                                                                                                                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Understand current phase & open questions     | [STATUS.md](STATUS.md) → [CHANGELOG.md](CHANGELOG.md)                                                                                                                                                                                                         |
| Work on core utilities or determinism         | [glossary.md](glossary.md) → [architecture/determinism.md](architecture/determinism.md) → [adr/0003-custom-ecs.md](adr/0003-custom-ecs.md)                                                                                                                    |
| Work on physics, collisions, or raycasts      | [architecture/physics-rapier.md](architecture/physics-rapier.md) → [adr/0001-use-rapier.md](adr/0001-use-rapier.md)                                                                                                                                           |
| Work on fields, diffusion, or spatial queries | [architecture/world-grid-fields.md](architecture/world-grid-fields.md) → [architecture/determinism.md](architecture/determinism.md)                                                                                                                           |
| Design creature appearance or add a shape     | [concepts/appearance.md](concepts/appearance.md) → [guides/design-creature-appearance.md](guides/design-creature-appearance.md) → [guides/add-shape.md](guides/add-shape.md) → [catalog/shapes.md](catalog/shapes.md)                                         |
| Work on SignalBus, wiring, or hormones        | [architecture/signal-bus.md](architecture/signal-bus.md) → [adr/0004-double-buffer-signal-bus.md](adr/0004-double-buffer-signal-bus.md) → [catalog/channels.md](catalog/channels.md)                                                                          |
| Add an organ or sensor                        | [concepts/organ.md](concepts/organ.md) → [concepts/sensor.md](concepts/sensor.md) → [guides/add-organ.md](guides/add-organ.md) → [guides/add-sensor.md](guides/add-sensor.md) → [catalog/sensors.md](catalog/sensors.md)                                      |
| Add an actuator, brain module, or spine       | [concepts/actuator.md](concepts/actuator.md) → [concepts/brain.md](concepts/brain.md) → [concepts/spine.md](concepts/spine.md) → [guides/add-brain-module.md](guides/add-brain-module.md) → [catalog/brain-modules.md](catalog/brain-modules.md)              |
| Work on metabolism, health, death, or corpses | [concepts/metabolism.md](concepts/metabolism.md) → [concepts/lifecycle.md](concepts/lifecycle.md) → [catalog/sensors.md](catalog/sensors.md)                                                                                                                  |
| Work on plants, pollination, fruit, or seeds  | [concepts/plants.md](concepts/plants.md) → [concepts/metabolism.md](concepts/metabolism.md) → [architecture/world-grid-fields.md](architecture/world-grid-fields.md)                                                                                          |
| Add or tune a Constraint Rule                 | [architecture/constraint-rules.md](architecture/constraint-rules.md) → [guides/add-rule.md](guides/add-rule.md) → [catalog/rules.md](catalog/rules.md)                                                                                                        |
| Change the simulation loop or Worker commands | [architecture/simulation-loop.md](architecture/simulation-loop.md) → [adr/0009-deterministic-sandbox-commands.md](adr/0009-deterministic-sandbox-commands.md)                                                                                                 |
| Use Sandbox UI, Scenarios, or Headless CLI    | [guides/sandbox-and-headless.md](guides/sandbox-and-headless.md) → [adr/0009-deterministic-sandbox-commands.md](adr/0009-deterministic-sandbox-commands.md)                                                                                                   |
| Add a species                                 | [glossary.md](glossary.md) → [concepts/genome.md](concepts/genome.md) → [guides/add-species.md](guides/add-species.md) → [concepts/appearance.md](concepts/appearance.md) → [catalog/species/README.md](catalog/species/README.md)                            |
| Add a learning module                         | [adr/0008-in-house-learning.md](adr/0008-in-house-learning.md) → [adr/0010-learning-neuromodulators.md](adr/0010-learning-neuromodulators.md) → [concepts/learning.md](concepts/learning.md) → [guides/add-learning-module.md](guides/add-learning-module.md) |

_(Entries in backticks are scheduled for upcoming phases and will become links when those phases land.)_

## Architecture Decision Records

- [ADR 0001: Use Rapier 2D (WASM) behind PhysicsAdapter](adr/0001-use-rapier.md)
- [ADR 0002: Strict TypeScript, Vite, and Worker Separation](adr/0002-strict-typescript-vite.md)
- [ADR 0003: Lightweight Custom ECS with TypedArrays for Hot Paths](adr/0003-custom-ecs.md)
- [ADR 0004: Double-Buffered SignalBus with Static Wiring and Hormones](adr/0004-double-buffer-signal-bus.md)
- [ADR 0005: Top-Down 2D Plane Without Gravity](adr/0005-top-down-view.md)
- [ADR 0006: Procedural Part-Tree Appearance Separated from Physics](adr/0006-procedural-rendering.md)
- [ADR 0007: All Numeric Limits as Configurable Constraint Rules](adr/0007-limits-as-rules.md)
- [ADR 0008: In-House Learning Core Without External ML Frameworks](adr/0008-in-house-learning.md)
- [ADR 0009: Deterministic Tick-Queued Commands for Interactive Sandbox Editing](adr/0009-deterministic-sandbox-commands.md)
- [ADR 0010: Simple Event-Driven Neuromodulators for Learning](adr/0010-learning-neuromodulators.md)

## Templates

- [Component Documentation Template](templates/component.md)
- [ADR Template](templates/adr.md)
