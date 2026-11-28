import { triggerRewardModulator } from '@brain/index';
import { SIMULATION_DEFAULTS, type SimulationConfig } from '@config/index';
import { assertFiniteNumber, InvalidParameterError, type EntityId, type Vec2 } from '@core/index';
import {
  mutationSpecSchema,
  ReproductionComponent,
  reproductionSpecSchema,
  stepReproductionSystem,
} from '@genome/index';
import {
  CorpseComponent,
  EnergyComponent,
  EnergyLedger,
  HealthComponent,
  stepAgingSystem,
  stepDeathSystem,
  stepDecompositionSystem,
  stepHealthSystem,
  stepInteractionSystem,
  stepMetabolismSystem,
  type DeathRecord,
} from '@life/index';
import type { CollisionEvent, PhysicsAdapter } from '@physics/types';
import {
  FruitComponent,
  PlantComponent,
  recordFruitBites,
  stepFruitSystem,
  stepPhotosynthesisSystem,
  stepPlantLifecycleSystem,
  stepPollinationSystem,
  stepSeedDispersalSystem,
} from '@plants/index';
import {
  CreatureBrainComponent,
  spawnSpeciesEntity,
  speciesRegistry,
  stepNervousSystem,
} from '@species/index';
import { PhysicsBodyComponent, TransformComponent, World, type WorldConfig } from '@world/index';
import { CommandQueue, type RecordedCommand, type SimCommand } from './commands';
import { inspectEntity, pickEntityAtWorldPos, type EntityInspection } from './inspector';
import { applyScenarioToWorld, type ScenarioConfig } from './scenario';
import { buildRenderSnapshot, type RenderSnapshot } from './snapshot';
import {
  collectGenomeSummary,
  collectSimulationStats,
  StatsHistory,
  type SimulationStatsSnapshot,
  type SpeciesGenomeSummary,
} from './stats';

/**
 * Transferable snapshot of a single environmental or scent grid field for heatmap rendering.
 */
export interface FieldHeatmapSnapshot {
  readonly fieldName: string;
  readonly cols: number;
  readonly rows: number;
  readonly cellSizeMeters: number;
  readonly maxValue: number;
  readonly data: Float32Array;
}

/**
 * Configuration for constructing a {@link Simulation} runner.
 */
export interface SimulationOptions {
  /** World dimensions, grid settings, and integer seed. */
  readonly world: WorldConfig;
  /** Optional update-rate overrides (defaults to {@link SIMULATION_DEFAULTS}). */
  readonly rates?: Partial<SimulationConfig>;
  /** Maximum fixed ticks allowed in a single `advance()` call to avoid spiral-of-death (default `10`). */
  readonly maxSubStepsPerAdvance?: number;
  /** Whether to record executed commands for deterministic replay (default `true`). */
  readonly recordCommands?: boolean;
  /** Whether animals with {@link ReproductionComponent} reproduce automatically (default `true`). */
  readonly enableReproduction?: boolean;
  /** Fixed ticks between automatic {@link StatsHistory} samples (default `15`). */
  readonly statsIntervalTicks?: number;
  /** Maximum samples retained in {@link StatsHistory} (default `600`). */
  readonly maxStatsSamples?: number;
  /** Optional {@link ScenarioConfig} applied immediately upon construction. */
  readonly scenario?: ScenarioConfig;
}

/**
 * Fixed-timestep deterministic simulation runner owning a {@link World}, {@link EnergyLedger},
 * {@link StatsHistory}, and {@link CommandQueue}. Has zero DOM or rendering dependencies and
 * runs identically in Node.js and Web Workers.
 */
export class Simulation {
  /** Underlying world state. */
  public readonly world: World;
  /** Energy conservation audit ledger. */
  public readonly ledger: EnergyLedger;
  /** Fixed simulation timestep in seconds. */
  public readonly fixedTimestepSeconds: number;
  /** Number of physics ticks between each field diffusion step. */
  public readonly fieldDiffusionIntervalTicks: number;

  private readonly commands: CommandQueue;
  private readonly statsHistory: StatsHistory;
  private readonly statsIntervalTicks: number;
  private readonly maxSubStepsPerAdvance: number;
  private readonly enableReproduction: boolean;
  private readonly baseScenario: ScenarioConfig | null;
  private readonly replaySchedule = new Map<number, SimCommand[]>();
  private accumulatorSeconds = 0;
  private lastCollisionEvents: readonly CollisionEvent[] = [];
  private lastDeathRecords: readonly DeathRecord[] = [];
  private cumulativeBirths = 0;
  private cumulativeDeaths = 0;

  /**
   * Creates a {@link Simulation}.
   *
   * @param options - World configuration, optional scenario, and rate overrides.
   * @param physics - Initialized {@link PhysicsAdapter} (Rapier or mock).
   */
  public constructor(options: SimulationOptions, physics: PhysicsAdapter) {
    const physicsRateHz = options.rates?.physicsRateHz ?? SIMULATION_DEFAULTS.physicsRateHz;
    const diffusionRateHz =
      options.rates?.fieldDiffusionRateHz ?? SIMULATION_DEFAULTS.fieldDiffusionRateHz;
    if (!Number.isFinite(physicsRateHz) || physicsRateHz <= 0) {
      throw new InvalidParameterError(
        'physicsRateHz',
        physicsRateHz,
        'a finite number > 0',
        'Simulation',
      );
    }
    if (!Number.isFinite(diffusionRateHz) || diffusionRateHz <= 0) {
      throw new InvalidParameterError(
        'fieldDiffusionRateHz',
        diffusionRateHz,
        'a finite number > 0',
        'Simulation',
      );
    }

    const maxSubSteps = options.maxSubStepsPerAdvance ?? 10;
    if (!Number.isInteger(maxSubSteps) || maxSubSteps < 1) {
      throw new InvalidParameterError(
        'maxSubStepsPerAdvance',
        maxSubSteps,
        'an integer >= 1',
        'Simulation',
      );
    }

    const statsInterval = options.statsIntervalTicks ?? 15;
    if (!Number.isInteger(statsInterval) || statsInterval < 1) {
      throw new InvalidParameterError(
        'statsIntervalTicks',
        statsInterval,
        'an integer >= 1',
        'Simulation',
      );
    }

    this.fixedTimestepSeconds = options.rates?.fixedTimestepSeconds ?? 1 / physicsRateHz;
    this.fieldDiffusionIntervalTicks = Math.max(1, Math.round(physicsRateHz / diffusionRateHz));
    this.maxSubStepsPerAdvance = maxSubSteps;
    this.statsIntervalTicks = statsInterval;
    this.enableReproduction =
      options.scenario?.enableReproduction ?? options.enableReproduction ?? true;
    this.baseScenario = options.scenario ?? null;

    const worldConfig = options.scenario?.world ?? options.world;
    this.world = new World(worldConfig, physics);
    this.ledger = new EnergyLedger();
    this.commands = new CommandQueue(options.recordCommands ?? true);
    this.statsHistory = new StatsHistory(options.maxStatsSamples ?? 600);

    if (options.scenario !== undefined) {
      applyScenarioToWorld(this.world, options.scenario, this.ledger);
      for (const recorded of options.scenario.commands) {
        const list = this.replaySchedule.get(recorded.tick) ?? [];
        list.push(recorded.command);
        this.replaySchedule.set(recorded.tick, list);
      }
    }

    this.statsHistory.record(this.getStats());
  }

  /** Enqueues an external command to be applied at the start of the next fixed tick. */
  public enqueueCommand(command: SimCommand): void {
    this.commands.enqueue(command);
  }

  /** Returns tick-stamped history of executed external commands. */
  public getCommandHistory(): readonly RecordedCommand[] {
    return this.commands.getHistory();
  }

  /** Returns the collision events collected during the most recent fixed tick. */
  public getLastCollisionEvents(): readonly CollisionEvent[] {
    return this.lastCollisionEvents;
  }

  /** Returns the death records emitted during the most recent fixed tick. */
  public getLastDeathRecords(): readonly DeathRecord[] {
    return this.lastDeathRecords;
  }

  /** Returns a live {@link SimulationStatsSnapshot} for the current tick. */
  public getStats(): SimulationStatsSnapshot {
    return collectSimulationStats(
      this.world,
      this.ledger,
      this.cumulativeBirths,
      this.cumulativeDeaths,
    );
  }

  /** Returns retained historical telemetry samples. */
  public getStatsHistory(): readonly SimulationStatsSnapshot[] {
    return this.statsHistory.getSamples();
  }

  /** Returns generation/offspring summaries across all living reproducing animals. */
  public getGenomeSummary(): readonly SpeciesGenomeSummary[] {
    return collectGenomeSummary(this.world);
  }

  /** Inspects a single entity's live SignalBus, brain memory, vitals, and Constraint Rules. */
  public inspectEntity(entityId: EntityId): EntityInspection | null {
    return inspectEntity(this.world, entityId);
  }

  /** Picks the closest entity near `position` in SI world meters, or `null` if none. */
  public pickEntity(position: Vec2, paddingMeters = 0.4): EntityId | null {
    return pickEntityAtWorldPos(this.world, position, paddingMeters);
  }

  /**
   * Copies a named grid field into a Transferable {@link FieldHeatmapSnapshot}.
   */
  public getFieldHeatmap(fieldName: string): FieldHeatmapSnapshot {
    const field = this.world.fields.get(fieldName);
    const copy = new Float32Array(field.data);
    let maxVal = 0;
    for (let i = 0; i < copy.length; i += 1) {
      const v = copy[i] ?? 0;
      if (v > maxVal) maxVal = v;
    }
    return {
      fieldName,
      cols: field.cols,
      rows: field.rows,
      cellSizeMeters: field.cellSizeMeters,
      maxValue: maxVal,
      data: copy,
    };
  }

  /**
   * Exports a replayable {@link ScenarioConfig} containing the base scenario and all recorded
   * tick-stamped Sandbox commands (ADR 0009).
   */
  public exportScenario(): ScenarioConfig {
    if (this.baseScenario !== null) {
      return {
        ...this.baseScenario,
        commands: [...this.commands.getHistory()],
      };
    }
    return {
      version: 1,
      name: 'custom-session',
      description: 'Exported EcoSim sandbox session.',
      world: this.world.config,
      enableReproduction: this.enableReproduction,
      initialFields: [],
      initialSpawns: [],
      commands: [...this.commands.getHistory()],
    };
  }

  /**
   * Advances the simulation by exactly one fixed timestep (`fixedTimestepSeconds`).
   */
  public stepFixed(): void {
    const scheduled = this.replaySchedule.get(this.world.tick);
    if (scheduled !== undefined) {
      for (const cmd of scheduled) {
        this.commands.enqueue(cmd);
      }
      this.replaySchedule.delete(this.world.tick);
    }

    const batch = this.commands.drainForTick(this.world.tick);
    for (const command of batch) {
      this.applyCommand(command);
    }

    const dt = this.fixedTimestepSeconds;
    const actions = stepNervousSystem(this.world, dt);
    const bites = stepInteractionSystem(this.world, actions, this.ledger);
    recordFruitBites(this.world, bites);

    for (const bite of bites) {
      if (bite.energyAssimilated <= 0) continue;
      const actorBrain = this.world.ecs.getComponent(bite.actorEntityId, CreatureBrainComponent);
      const actorEnergy = this.world.ecs.getComponent(bite.actorEntityId, EnergyComponent);
      if (
        actorBrain?.neuromodulators !== undefined &&
        actorEnergy !== undefined &&
        actorEnergy.max > 0
      ) {
        triggerRewardModulator(
          actorBrain.neuromodulators,
          bite.energyAssimilated / actorEnergy.max,
        );
      }
    }

    stepPhotosynthesisSystem(this.world, dt, this.ledger);
    stepAgingSystem(this.world, dt);
    stepMetabolismSystem(this.world, dt, this.ledger);
    stepPlantLifecycleSystem(this.world, dt);
    stepPollinationSystem(this.world, dt);
    stepFruitSystem(this.world, dt, this.ledger);
    stepSeedDispersalSystem(this.world, dt);
    stepHealthSystem(this.world, dt);
    const deaths = stepDeathSystem(this.world, this.ledger);
    this.lastDeathRecords = deaths;
    this.cumulativeDeaths += deaths.length;
    stepDecompositionSystem(this.world, dt, this.ledger);

    if (this.enableReproduction) {
      const births = stepReproductionSystem(this.world, dt, this.ledger);
      this.cumulativeBirths += births.length;
    }

    this.world.physics.step(dt);
    this.lastCollisionEvents = this.world.physics.drainCollisionEvents();
    this.world.syncFromPhysics();

    this.world.tick += 1;
    this.world.timeSeconds = this.world.tick * dt;

    if (this.world.tick % this.fieldDiffusionIntervalTicks === 0) {
      this.world.fields.stepDiffusion();
    }
    if (this.world.tick % this.statsIntervalTicks === 0) {
      this.statsHistory.record(this.getStats());
    }
  }

  /**
   * Feeds variable real-time frame delta `elapsedSeconds` into the fixed-timestep accumulator
   * and executes zero or more fixed ticks (capped at `maxSubStepsPerAdvance`).
   *
   * @param elapsedSeconds - Non-negative finite elapsed time in seconds.
   * @returns Number of fixed ticks executed during this call.
   */
  public advance(elapsedSeconds: number): number {
    assertFiniteNumber('elapsedSeconds', elapsedSeconds, 'Simulation.advance');
    if (elapsedSeconds < 0) {
      throw new InvalidParameterError(
        'elapsedSeconds',
        elapsedSeconds,
        'a finite number >= 0',
        'Simulation.advance',
      );
    }

    this.accumulatorSeconds += elapsedSeconds;
    let steps = 0;
    while (
      this.accumulatorSeconds >= this.fixedTimestepSeconds - 1e-12 &&
      steps < this.maxSubStepsPerAdvance
    ) {
      this.stepFixed();
      this.accumulatorSeconds -= this.fixedTimestepSeconds;
      steps += 1;
    }

    if (
      steps === this.maxSubStepsPerAdvance &&
      this.accumulatorSeconds > this.fixedTimestepSeconds
    ) {
      this.accumulatorSeconds = this.fixedTimestepSeconds;
    }
    return steps;
  }

  /** Builds a compact Transferable {@link RenderSnapshot} of the current world state. */
  public getSnapshot(): RenderSnapshot {
    return buildRenderSnapshot(this.world);
  }

  /**
   * Computes a deterministic 32-bit FNV-1a hash of the simulation state (tick, entity transforms,
   * ecosystem vitals, brain bus state, and field buffers) for determinism regression tests.
   */
  public computeStateHash(): number {
    let hash = 0x811c9dc5;
    const f32 = new Float32Array(1);
    const u32 = new Uint32Array(f32.buffer);

    const mixUint32 = (value: number): void => {
      hash ^= value >>> 0;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    };
    const mixFloat = (value: number): void => {
      f32[0] = Object.is(value, -0) ? 0 : value;
      mixUint32(u32[0] ?? 0);
    };

    mixUint32(this.world.tick);
    const entities = this.world.ecs.query(TransformComponent);
    mixUint32(entities.length);
    for (const entity of entities) {
      const t = this.world.ecs.requireComponent(entity, TransformComponent);
      mixUint32(entity);
      mixFloat(t.x);
      mixFloat(t.y);
      mixFloat(t.angle);
    }

    for (const entity of this.world.ecs.query(EnergyComponent)) {
      const e = this.world.ecs.requireComponent(entity, EnergyComponent);
      mixUint32(entity);
      mixFloat(e.current);
    }
    for (const entity of this.world.ecs.query(HealthComponent)) {
      const h = this.world.ecs.requireComponent(entity, HealthComponent);
      mixUint32(entity);
      mixFloat(h.current);
    }
    for (const entity of this.world.ecs.query(PlantComponent)) {
      const p = this.world.ecs.requireComponent(entity, PlantComponent);
      mixUint32(entity);
      mixFloat(p.organs.leafArea);
    }
    for (const entity of this.world.ecs.query(FruitComponent)) {
      const f = this.world.ecs.requireComponent(entity, FruitComponent);
      mixUint32(entity);
      mixFloat(f.ageSeconds);
    }
    for (const entity of this.world.ecs.query(CorpseComponent)) {
      const c = this.world.ecs.requireComponent(entity, CorpseComponent);
      mixUint32(entity);
      mixFloat(c.energy);
    }
    for (const entity of this.world.ecs.query(CreatureBrainComponent)) {
      const b = this.world.ecs.requireComponent(entity, CreatureBrainComponent);
      for (let i = 0; i < b.bus.channelCount; i += 1) {
        mixFloat(b.bus.readIndex(i));
      }
    }

    for (const name of this.world.fields.names()) {
      const data = this.world.fields.get(name).data;
      for (let i = 0; i < data.length; i += 1) {
        mixFloat(data[i] ?? 0);
      }
    }

    return hash >>> 0;
  }

  /** Releases all physics and world resources. */
  public free(): void {
    this.commands.clear();
    this.statsHistory.clear();
    this.replaySchedule.clear();
    this.world.free();
  }

  private applyCommand(command: SimCommand): void {
    switch (command.type) {
      case 'spawn-body':
        this.world.spawnSimpleBody({
          position: command.position,
          radius: command.radius,
          ...(command.color !== undefined ? { color: command.color } : {}),
          ...(command.kind !== undefined ? { kind: command.kind } : {}),
          ...(command.linearVelocity !== undefined
            ? { linearVelocity: command.linearVelocity }
            : {}),
          ...(command.tags !== undefined ? { tags: command.tags } : {}),
        });
        break;

      case 'spawn-species': {
        const blueprint = speciesRegistry.get(command.speciesId);
        const entity = spawnSpeciesEntity(this.world, blueprint, command.position, {
          ...(command.angle !== undefined ? { angle: command.angle } : {}),
          ...(command.plantStage !== undefined
            ? { plantOptions: { stage: command.plantStage } }
            : {}),
          ...(command.reproductiveOrgan !== undefined
            ? { reproductiveOrgan: command.reproductiveOrgan }
            : {}),
          ...(command.initialEnergy !== undefined ? { initialEnergy: command.initialEnergy } : {}),
          ...(command.initialAgeSeconds !== undefined
            ? { initialAgeSeconds: command.initialAgeSeconds }
            : {}),
          ...(command.maxAgeSeconds !== undefined ? { maxAgeSeconds: command.maxAgeSeconds } : {}),
        });
        if (this.enableReproduction && blueprint.kingdom === 'animal') {
          const spec = reproductionSpecSchema.parse({
            mode: 'sexual',
            minEnergyToReproduce: Math.max(76, blueprint.metabolism.maxEnergy * 0.76),
            mateRadiusMeters: 1.2,
            requireOrganContact: true,
          });
          this.world.ecs.addComponent(entity, ReproductionComponent, {
            speciesId: blueprint.id,
            blueprint,
            spec,
            mutation: mutationSpecSchema.parse({}),
            cooldownRemainingSeconds: spec.cooldownSeconds * 0.5,
            generation: 0,
            offspringCount: 0,
          });
        }
        const energy = this.world.ecs.getComponent(entity, EnergyComponent);
        if (energy !== undefined) {
          this.ledger.recordInitialSpawn(energy.current + energy.structuralEnergy);
        }
        break;
      }

      case 'remove-entity':
        this.world.removeEntity(command.entityId);
        break;

      case 'paint-field':
        this.world.fields.paintField(
          command.fieldName,
          command.x,
          command.y,
          command.radiusMeters,
          command.value,
          command.mode ?? 'set',
        );
        break;

      case 'apply-impulse':
        this.applyImpulseToEntity(command.entityId, command.impulse);
        break;

      case 'clear-world': {
        const allEntities = [...this.world.ecs.query(TransformComponent)];
        for (const id of allEntities) {
          this.world.removeEntity(id);
        }
        break;
      }
    }
  }

  private applyImpulseToEntity(entityId: EntityId, impulse: Vec2): void {
    const body = this.world.ecs.getComponent(entityId, PhysicsBodyComponent);
    if (body === undefined) return;
    this.world.physics.applyImpulse(body.bodyHandle, impulse);
  }
}
