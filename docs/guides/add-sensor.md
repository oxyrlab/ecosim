# Guide: Add a Sensor

1. Create `src/body/sensors/<sensor-id>.ts` using `defineSensor(...)` with typed `port.analog(...)` / `port.pulse(...)` outputs (static or param-dependent), Zod `params`, and zero-allocation `sample(ctx, out)`.
2. Read World state only through `SensorContext` (read-only).
3. Add a sibling unit test `src/body/sensors/<sensor-id>.test.ts`.
4. Register it in `BUILTIN_SENSORS` (`src/body/sensors/index.ts`) and add a fixture entry to `SENSOR_FIXTURES` in `tests/contracts/registry-contracts.test.ts`.
5. Run `npm run docs:catalog && npm run test:coverage && npm run docs:check`.
