import type { PortMap } from '@bus/ports';
import type { Registry } from '@core/index';
import { energySensor } from './energy-sensor';
import { olfactorySensor } from './olfactory-sensor';
import { painSensor } from './pain-sensor';
import { reproductiveSensor } from './reproductive-sensor';
import { registerSensor, sensorRegistry, type SensorDef } from './sensor-def';
import { visionSensor } from './vision-sensor';

/** All built-in sensor definitions. */
export const BUILTIN_SENSORS: readonly SensorDef<unknown, PortMap>[] = Object.freeze([
  visionSensor as SensorDef<unknown, PortMap>,
  olfactorySensor as SensorDef<unknown, PortMap>,
  energySensor as SensorDef<unknown, PortMap>,
  painSensor as SensorDef<unknown, PortMap>,
  reproductiveSensor as SensorDef<unknown, PortMap>,
]);

/** Registers all built-in sensors into `registry` (idempotent). */
export function registerBuiltinSensors(
  registry: Registry<SensorDef<unknown, PortMap>> = sensorRegistry,
): void {
  for (const sensor of BUILTIN_SENSORS) {
    if (!registry.has(sensor.id)) {
      registerSensor(sensor, registry);
    }
  }
}

registerBuiltinSensors(sensorRegistry);

export { energySensor, energySensorParamsSchema } from './energy-sensor';
export {
  olfactorySensor,
  olfactorySensorParamsSchema,
  type OlfactorySensorParams,
} from './olfactory-sensor';
export { painSensor, painSensorParamsSchema } from './pain-sensor';
export {
  reproductiveSensor,
  reproductiveSensorParamsSchema,
  type ReproductiveSensorParams,
} from './reproductive-sensor';
export {
  defineSensor,
  registerSensor,
  resolvePortMap,
  sensorRegistry,
  type InternalBodyState,
  type NeighborObservation,
  type NeighborReproductiveOrgan,
  type PortMapOrFactory,
  type SensorContext,
  type SensorDef,
  type SensorInstance,
  type SensorRaycastHit,
} from './sensor-def';
export { visionSensor, visionSensorParamsSchema, type VisionSensorParams } from './vision-sensor';
