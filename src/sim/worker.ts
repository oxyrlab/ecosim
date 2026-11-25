import * as Comlink from 'comlink';
import { InvariantViolationError } from '@core/index';
import { createRapierPhysicsAdapter } from '@physics/index';
import type { SimCommand, RecordedCommand } from './commands';
import { Simulation, type SimulationOptions } from './simulation';
import type { RenderSnapshot } from './snapshot';

/**
 * RPC interface exposed by the EcoSim Web Worker via Comlink.
 */
export interface SimWorkerApi {
  /** Initializes Rapier WASM and constructs a fresh {@link Simulation}. */
  init(options: SimulationOptions): Promise<RenderSnapshot>;
  /** Enqueues a deterministic command to run at the start of the next fixed tick. */
  enqueueCommand(command: SimCommand): void;
  /** Advances the fixed-timestep accumulator by `elapsedSeconds` and returns a Transferable snapshot. */
  advance(elapsedSeconds: number): RenderSnapshot;
  /** Steps exactly `ticks` fixed timesteps and returns a Transferable snapshot. */
  stepFixed(ticks?: number): RenderSnapshot;
  /** Returns the current Transferable snapshot without advancing time. */
  getSnapshot(): RenderSnapshot;
  /** Returns tick-stamped history of all commands applied to this simulation. */
  getCommandHistory(): readonly RecordedCommand[];
  /** Returns the deterministic FNV-1a state hash for the current tick. */
  computeStateHash(): number;
  /** Frees the simulation and its underlying Rapier WASM world. */
  dispose(): void;
}

/**
 * Creates a {@link SimWorkerApi} controller backed by deterministic Rapier 2D.
 * Factored as a pure factory so it can be exposed via Comlink in a Worker and tested in Node.js.
 *
 * @param transferSnapshots - When `true` (default in Worker), wraps snapshots in `Comlink.transfer`.
 */
export function createSimWorkerController(transferSnapshots = true): SimWorkerApi {
  let simulation: Simulation | null = null;

  const requireSim = (): Simulation => {
    if (simulation === null) {
      throw new InvariantViolationError(
        'Simulation worker has not been initialized. Call init() first.',
      );
    }
    return simulation;
  };

  const emitSnapshot = (snap: RenderSnapshot): RenderSnapshot =>
    transferSnapshots ? Comlink.transfer(snap, [snap.entities.buffer]) : snap;

  return {
    async init(options: SimulationOptions): Promise<RenderSnapshot> {
      if (simulation !== null) {
        simulation.free();
        simulation = null;
      }
      const physics = await createRapierPhysicsAdapter();
      simulation = new Simulation(options, physics);
      return emitSnapshot(simulation.getSnapshot());
    },

    enqueueCommand(command: SimCommand): void {
      requireSim().enqueueCommand(command);
    },

    advance(elapsedSeconds: number): RenderSnapshot {
      const sim = requireSim();
      sim.advance(elapsedSeconds);
      return emitSnapshot(sim.getSnapshot());
    },

    stepFixed(ticks = 1): RenderSnapshot {
      const sim = requireSim();
      for (let i = 0; i < ticks; i += 1) {
        sim.stepFixed();
      }
      return emitSnapshot(sim.getSnapshot());
    },

    getSnapshot(): RenderSnapshot {
      return emitSnapshot(requireSim().getSnapshot());
    },

    getCommandHistory(): readonly RecordedCommand[] {
      return requireSim().getCommandHistory();
    },

    computeStateHash(): number {
      return requireSim().computeStateHash();
    },

    dispose(): void {
      if (simulation !== null) {
        simulation.free();
        simulation = null;
      }
    },
  };
}

// Auto-expose when loaded as a dedicated Web Worker entry point.
const isDedicatedWorker =
  typeof self !== 'undefined' &&
  typeof (self as { postMessage?: unknown }).postMessage === 'function' &&
  typeof window === 'undefined';

if (isDedicatedWorker) {
  Comlink.expose(createSimWorkerController(true));
}
