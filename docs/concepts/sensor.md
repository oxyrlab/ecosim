# Sensors

A **Sensor** (`src/body/sensors/`) samples read-only World or body state via `SensorContext` (`queryNeighbors`, `sampleField`, `castRay`) and writes normalized numeric signals to its `SignalBus` output handles.

- Ports may be static or computed from validated Zod `params` (`vision-sensor` generates `seen.<tag>`, `dir.<tag>`, and `sector.tag.<tag>` dynamically; `olfactory-sensor` generates `intensity.<ch>` and `gradient.<ch>`).
- See [docs/catalog/sensors.md](../catalog/sensors.md) and [guides/add-sensor.md](../guides/add-sensor.md).
