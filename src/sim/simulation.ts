import { SIMULATION_DEFAULTS, type SimulationConfig } from '@config/index';
import { assertFiniteNumber, InvalidParameterError, type EntityId } from '@core/index';
import type { CollisionEvent, PhysicsAdapter } from '@physics/types';
import { PhysicsBodyComponent, TransformComponent, World, type WorldConfig } from '@world/index';
import { CommandQueue, type RecordedCommand, type SimCommand } from './commands';
import { buildRenderSnapshot, type RenderSnapshot } from './snapshot';

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
}

/**
 * Fixed-timestep deterministic simulation runner owning a {@link World} and {@link CommandQueue}.
 * Has zero DOM or rendering dependencies and runs identically in Node.js and Web Workers.
 */
export class Simulation {
  /** Underlying world state. */
  public readonly world: World;
  /** Fixed simulation timestep in seconds. */
  public readonly fixedTimestepSeconds: number;
  /** Number of physics ticks between each field diffusion step. */
  public readonly fieldDiffusionIntervalTicks: number;

  private readonly commands: CommandQueue;
  private readonly maxSubStepsPerAdvance: number;
  private accumulatorSeconds = 0;
  private lastCollisionEvents: readonly CollisionEvent[] = [];

  /**
   * Creates a {@link Simulation}.
   *
   * @param options - World configuration and optional rate overrides.
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

    this.fixedTimestepSeconds = options.rates?.fixedTimestepSeconds ?? 1 / physicsRateHz;
    this.fieldDiffusionIntervalTicks = Math.max(1, Math.round(physicsRateHz / diffusionRateHz));
    this.maxSubStepsPerAdvance = maxSubSteps;
    this.world = new World(options.world, physics);
    this.commands = new CommandQueue(options.recordCommands ?? true);
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

  /**
   * Advances the simulation by exactly one fixed timestep (`fixedTimestepSeconds`).
   */
  public stepFixed(): void {
    const batch = this.commands.drainForTick(this.world.tick);
    for (const command of batch) {
      this.applyCommand(command);
    }

    this.world.physics.step(this.fixedTimestepSeconds);
    this.lastCollisionEvents = this.world.physics.drainCollisionEvents();
    this.world.syncFromPhysics();

    this.world.tick += 1;
    this.world.timeSeconds = this.world.tick * this.fixedTimestepSeconds;

    if (this.world.tick % this.fieldDiffusionIntervalTicks === 0) {
      this.world.fields.stepDiffusion();
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
   * and field buffers) for determinism regression tests.
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
    }
  }

  private applyImpulseToEntity(entityId: EntityId, impulse: { x: number; y: number }): void {
    const body = this.world.ecs.getComponent(entityId, PhysicsBodyComponent);
    if (body === undefined) return;
    this.world.physics.applyImpulse(body.bodyHandle, impulse);
  }
}
