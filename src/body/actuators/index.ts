import type { PortMap } from '@bus/ports';
import type { Registry } from '@core/index';
import { actuatorRegistry, registerActuator, type ActuatorDef } from './actuator-def';
import { biteActuator } from './bite';
import { rotatorActuator } from './rotator';
import { thrusterActuator } from './thruster';

/** All built-in actuator definitions. */
export const BUILTIN_ACTUATORS: readonly ActuatorDef<unknown, PortMap>[] = Object.freeze([
  thrusterActuator as ActuatorDef<unknown, PortMap>,
  rotatorActuator as ActuatorDef<unknown, PortMap>,
  biteActuator as ActuatorDef<unknown, PortMap>,
]);

/** Registers all built-in actuators into `registry` (idempotent). */
export function registerBuiltinActuators(
  registry: Registry<ActuatorDef<unknown, PortMap>> = actuatorRegistry,
): void {
  for (const actuator of BUILTIN_ACTUATORS) {
    if (!registry.has(actuator.id)) {
      registerActuator(actuator, registry);
    }
  }
}

registerBuiltinActuators(actuatorRegistry);

export {
  actuatorRegistry,
  defineActuator,
  registerActuator,
  type ActuatorActionEvent,
  type ActuatorContext,
  type ActuatorDef,
  type ActuatorInstance,
  type EnergyCostModel,
} from './actuator-def';
export { biteActuator, biteParamsSchema, type BiteParams } from './bite';
export { rotatorActuator, rotatorParamsSchema, type RotatorParams } from './rotator';
export { thrusterActuator, thrusterParamsSchema, type ThrusterParams } from './thruster';
