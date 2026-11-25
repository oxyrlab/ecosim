import type { PortMap } from '@bus/ports';
import type { Registry } from '@core/index';
import { differentialDriveSpine } from './differential-drive';
import { registerSpine, spineRegistry, type SpineDef } from './spine-def';

/** All built-in spine definitions. */
export const BUILTIN_SPINES: readonly SpineDef<unknown, PortMap, PortMap>[] = Object.freeze([
  differentialDriveSpine as SpineDef<unknown, PortMap, PortMap>,
]);

/** Registers all built-in spines into `registry` (idempotent). */
export function registerBuiltinSpines(
  registry: Registry<SpineDef<unknown, PortMap, PortMap>> = spineRegistry,
): void {
  for (const spine of BUILTIN_SPINES) {
    if (!registry.has(spine.id)) {
      registerSpine(spine, registry);
    }
  }
}

registerBuiltinSpines(spineRegistry);

export {
  differentialDriveParamsSchema,
  differentialDriveSpine,
  type DifferentialDriveParams,
} from './differential-drive';
export {
  defineSpine,
  registerSpine,
  spineRegistry,
  type SpineDef,
  type SpineInstance,
} from './spine-def';
