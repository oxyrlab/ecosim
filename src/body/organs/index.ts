import type { Registry } from '@core/index';
import { bodyCoreOrgan } from './body-core';
import { eyeOrgan } from './eye';
import { mouthOrgan } from './mouth';
import { noseOrgan } from './nose';
import { organRegistry, registerOrgan, type OrganDef } from './organ-def';
import { reproductiveFemaleOrgan, reproductiveMaleOrgan } from './reproductive-organ';

/** All built-in organ definitions. */
export const BUILTIN_ORGANS: readonly OrganDef<unknown>[] = Object.freeze([
  bodyCoreOrgan as OrganDef<unknown>,
  eyeOrgan as OrganDef<unknown>,
  noseOrgan as OrganDef<unknown>,
  mouthOrgan as OrganDef<unknown>,
  reproductiveMaleOrgan as OrganDef<unknown>,
  reproductiveFemaleOrgan as OrganDef<unknown>,
]);

/** Registers all built-in organs into `registry` (idempotent). */
export function registerBuiltinOrgans(registry: Registry<OrganDef<unknown>> = organRegistry): void {
  for (const organ of BUILTIN_ORGANS) {
    if (!registry.has(organ.id)) {
      registerOrgan(organ, registry);
    }
  }
}

registerBuiltinOrgans(organRegistry);

export { bodyCoreOrgan } from './body-core';
export { eyeOrgan } from './eye';
export { mouthOrgan } from './mouth';
export { noseOrgan } from './nose';
export { defineOrgan, organRegistry, registerOrgan, type OrganDef } from './organ-def';
export {
  REPRODUCTIVE_ORGAN_COLORS,
  ReproductiveOrganComponent,
  areOrgansComplementary,
  computeOrganWorldPosition,
  createReproductiveOrganData,
  organIdToSex,
  reproductiveFemaleOrgan,
  reproductiveMaleOrgan,
  sexToOrganId,
  type BiologicalSex,
  type ReproductiveOrganData,
  type ReproductiveOrganId,
} from './reproductive-organ';
