import * as Comlink from 'comlink';
import { createEntityId, InvariantViolationError, type Vec2 } from '@core/index';
import { createRapierPhysicsAdapter } from '@physics/index';
import { speciesRegistry } from '@species/index';
import type { RecordedCommand, SimCommand } from './commands';
import type { EntityInspection } from './inspector';
import { parseScenarioConfig, type ScenarioConfig } from './scenario';
import { Simulation, type FieldHeatmapSnapshot, type SimulationOptions } from './simulation';
import type { RenderSnapshot } from './snapshot';
import type { SimulationStatsSnapshot } from './stats';

/**
 * Lightweight descriptor of a registered species returned to the Observation & Sandbox UI.
 */
export interface SpeciesSummary {
  readonly id: string;
  readonly name: string;
  readonly kingdom: 'animal' | 'plant';
  readonly color: number;
}

/**
 * RPC interface exposed by the EcoSim Web Worker via Comlink.
 */
export interface SimWorkerApi {
  /** Initializes Rapier WASM and constructs a fresh {@link Simulation}. */
  init(options: SimulationOptions): Promise<RenderSnapshot>;
  /** Loads a validated {@link ScenarioConfig} into a fresh deterministic {@link Simulation}. */
  loadScenario(scenario: ScenarioConfig): Promise<RenderSnapshot>;
  /** Exports the active scenario plus all recorded tick-stamped Sandbox commands (ADR 0009). */
  exportScenario(): ScenarioConfig;
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
  /** Returns current population, energy, and birth/death telemetry. */
  getStats(): SimulationStatsSnapshot;
  /** Returns chronological historical telemetry samples for population charts. */
  getStatsHistory(): readonly SimulationStatsSnapshot[];
  /** Returns live entity inspection data (SignalBus, brain memory, vitals, rules). */
  inspectEntity(entityId: number): EntityInspection | null;
  /** Picks the closest entity near world-space `position`, or `null` if none. */
  pickEntity(position: Vec2): number | null;
  /** Copies a named field into a Transferable {@link FieldHeatmapSnapshot}. */
  getFieldHeatmap(fieldName: string): FieldHeatmapSnapshot;
  /** Lists all registered species available in the Sandbox palette. */
  listSpecies(): readonly SpeciesSummary[];
  /** Lists all named environmental/scent fields in the active world. */
  listFields(): readonly string[];
  /** Returns the deterministic FNV-1a state hash for the current tick. */
  computeStateHash(): number;
  /** Frees the simulation and its underlying Rapier WASM world. */
  dispose(): void;
}

/**
 * Creates a {@link SimWorkerApi} controller backed by deterministic Rapier 2D.
 * Factored as a pure factory so it can be exposed via Comlink in a Worker and tested in Node.js.
 *
 * @param transferSnapshots - When `true` (default in Worker), wraps typed arrays in `Comlink.transfer`.
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

  const emitHeatmap = (map: FieldHeatmapSnapshot): FieldHeatmapSnapshot =>
    transferSnapshots ? Comlink.transfer(map, [map.data.buffer]) : map;

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

    async loadScenario(scenario: ScenarioConfig): Promise<RenderSnapshot> {
      const validated = parseScenarioConfig(scenario);
      if (simulation !== null) {
        simulation.free();
        simulation = null;
      }
      const physics = await createRapierPhysicsAdapter();
      simulation = new Simulation({ world: validated.world, scenario: validated }, physics);
      return emitSnapshot(simulation.getSnapshot());
    },

    exportScenario(): ScenarioConfig {
      return requireSim().exportScenario();
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

    getStats(): SimulationStatsSnapshot {
      return requireSim().getStats();
    },

    getStatsHistory(): readonly SimulationStatsSnapshot[] {
      return requireSim().getStatsHistory();
    },

    inspectEntity(entityId: number): EntityInspection | null {
      return requireSim().inspectEntity(createEntityId(entityId));
    },

    pickEntity(position: Vec2): number | null {
      return requireSim().pickEntity(position);
    },

    getFieldHeatmap(fieldName: string): FieldHeatmapSnapshot {
      return emitHeatmap(requireSim().getFieldHeatmap(fieldName));
    },

    listSpecies(): readonly SpeciesSummary[] {
      return speciesRegistry.ids().map((id) => {
        const bp = speciesRegistry.get(id);
        return {
          id: bp.id,
          name: bp.name,
          kingdom: bp.kingdom,
          color: bp.kingdom === 'animal' ? bp.stubColor : bp.plantSpec.plantColor,
        };
      });
    },

    listFields(): readonly string[] {
      return requireSim().world.fields.names();
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
