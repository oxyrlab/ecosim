# Glossary

Precise definitions of terms used across EcoSim code and documentation. All physical units are SI: meters (`m`), seconds (`s`), radians (`rad`), kilograms (`kg`), and energy units (`EU`).

| Term                 | Definition                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Actuator**         | Component hosted on an Organ that reads motor commands from the `SignalBus` and applies physical or world effects (force, torque, bite, scent emission) at an energy cost.                               |
| **Blueprint**        | Declarative genome data defining a species' body part tree, organs, sensors, actuators, brain modules, spine, wiring, metabolism, lifecycle, reproduction, mutation ranges, and optional rule overrides. |
| **BrainModule**      | Isolated processing unit inside a creature's brain. Reads input ports and subscribed hormones, writes output ports and published hormones; never accesses other modules or the World directly.           |
| **Channel**          | Single numeric slot (`Float32Array` index) on a creature's `SignalBus`, typed as `analog` (continuous within a declared range) or `pulse` (one-tick event reset after read).                             |
| **Component (ECS)**  | Plain typed data record attached to an `EntityId` inside an `EcsWorld`.                                                                                                                                  |
| **Constraint Rule**  | Registered, configurable validation/budget rule (`src/rules/`) with a documented `rationale`, Zod-validated params, and severity (`error`, `warn`, `off`). Replaces all hard-coded numeric limits.       |
| **Entity**           | Positive integer `EntityId` representing any simulated object (animal, plant, fruit, seed, corpse).                                                                                                      |
| **Energy Unit (EU)** | Simulation currency for metabolism, actuator work, brain upkeep, growth, reproduction, and corpse nutrients. Audited by `EnergyLedger`.                                                                  |
| **Field**            | 2D grid layer stored as a `Float32Array` over the world (e.g. `scent.plant`, `soil.nutrients`, `light`).                                                                                                 |
| **Hormone**          | Broadcast channel in a creature's `SignalBus` connecting publishers and subscribers without explicit point-to-point wiring; also used for neuromodulator signals.                                        |
| **Learner**          | Fixed-size, deterministic, allocation-free online learning primitive (`predict`, `learn`, `decay`, `serialize`, `restore`) supplied by `@oxyrlab/neuro-learn` in Phase 6.                                |
| **Organ**            | Physical body part defined by a shape; may have a Rapier collider and host zero or more Sensors and zero or one Actuator.                                                                                |
| **Port**             | Local named input or output interface declared by a Sensor, Actuator, BrainModule, or Spine, resolved to numeric bus indices at spawn time.                                                              |
| **Registry**         | Named store enforcing unique `kebab-case` ids and deterministic registration order for component definitions.                                                                                            |
| **Sensor**           | Component hosted on an Organ that samples read-only World or body state via `SensorContext` and writes to its `SignalBus` output ports.                                                                  |
| **SignalBus**        | Per-creature double-buffered (`current` / `next`) `Float32Array` carrier implementing a one-tick neural delay and order-independent module execution.                                                    |
| **Spine**            | Species-specific translator mapping high-level brain motor patterns to concrete Actuator commands and optional low-level reflexes.                                                                       |
| **Tag**              | String label attached to entities for sensor filtering and interactions (e.g. `herbivore`, `predator`, `plant`, `fruit`, `corpse`, `species:rabbit`).                                                    |
