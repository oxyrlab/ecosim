# Actuators

An **Actuator** (`src/body/actuators/`) reads motor commands from its `SignalBus` input handles and applies physical forces/torques, field emissions, or discrete actions (`bite`) through `ActuatorContext`, always deducting energy according to its `energyCost(params)` model.

- Actuators hosted on `joint: 'visual'` parts route forces to the part's `physicalAncestorId` at the visual part's world position (enabling mirrored visual differential drive).
- See [docs/catalog/actuators.md](../catalog/actuators.md).
