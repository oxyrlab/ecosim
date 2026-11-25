import RAPIER from '@dimforge/rapier2d-deterministic-compat';

let initPromise: Promise<typeof RAPIER> | null = null;
let initialized = false;

/**
 * Initializes the Rapier 2D deterministic WASM module exactly once and returns the module namespace.
 * Safe to call multiple times across Worker startup, headless runs, and test suites.
 *
 * @returns Resolved Rapier 2D module.
 */
export async function initRapier(): Promise<typeof RAPIER> {
  if (initialized) {
    return RAPIER;
  }
  if (initPromise === null) {
    initPromise = RAPIER.init().then(() => {
      initialized = true;
      return RAPIER;
    });
  }
  return initPromise;
}

/**
 * Returns `true` if {@link initRapier} has finished loading the WASM module.
 */
export function isRapierInitialized(): boolean {
  return initialized;
}
