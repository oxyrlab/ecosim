import { createMockPhysicsAdapter, createRapierPhysicsAdapter } from '@physics/index';
import { Simulation, type SimulationOptions } from '@sim/index';
import { World, type WorldConfig } from '@world/index';

/**
 * Default small world configuration for unit and integration tests.
 */
export function makeTestWorldConfig(overrides: Partial<WorldConfig> = {}): WorldConfig {
  return {
    seed: 1337,
    widthMeters: 20,
    heightMeters: 20,
    gridCols: 10,
    gridRows: 10,
    addBoundaryWalls: true,
    ...overrides,
  };
}

/**
 * Creates a fast test {@link World} backed by {@link createMockPhysicsAdapter}.
 */
export function createTestWorld(overrides: Partial<WorldConfig> = {}): World {
  return new World(makeTestWorldConfig(overrides), createMockPhysicsAdapter());
}

/**
 * Creates a real Rapier-backed {@link Simulation} for integration and scenario tests.
 */
export async function createRapierTestSimulation(
  overrides: Partial<WorldConfig> = {},
  simOptions: Omit<SimulationOptions, 'world'> = {},
): Promise<Simulation> {
  const physics = await createRapierPhysicsAdapter();
  return new Simulation({ ...simOptions, world: makeTestWorldConfig(overrides) }, physics);
}

/**
 * Advances a {@link Simulation} by exactly `ticks` fixed timesteps.
 */
export function stepTicks(simulation: Simulation, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) {
    simulation.stepFixed();
  }
}
