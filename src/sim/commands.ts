import type { EntityId, Vec2 } from '@core/index';
import type { PlantStage } from '@plants/components';
import type { FieldBrushMode } from '@world/index';

/**
 * Deterministic commands sent from the UI, Worker host, or scenario scripts into the simulation.
 * Applied at the start of the next fixed tick so interactive edits remain reproducible (ADR 0009).
 */
export type SimCommand =
  | {
      readonly type: 'spawn-body';
      readonly position: Vec2;
      readonly radius: number;
      readonly color?: number;
      readonly kind?: number;
      readonly linearVelocity?: Vec2;
      readonly tags?: readonly string[];
    }
  | {
      readonly type: 'spawn-species';
      readonly speciesId: string;
      readonly position: Vec2;
      readonly angle?: number;
      readonly plantStage?: PlantStage;
    }
  | {
      readonly type: 'remove-entity';
      readonly entityId: EntityId;
    }
  | {
      readonly type: 'paint-field';
      readonly fieldName: string;
      readonly x: number;
      readonly y: number;
      readonly radiusMeters: number;
      readonly value: number;
      readonly mode?: FieldBrushMode;
    }
  | {
      readonly type: 'apply-impulse';
      readonly entityId: EntityId;
      readonly impulse: Vec2;
    }
  | {
      readonly type: 'clear-world';
    };

/**
 * A {@link SimCommand} paired with the simulation tick on which it was executed, enabling
 * exact replay of interactive Sandbox sessions alongside `worldSeed`.
 */
export interface RecordedCommand {
  /** Simulation tick at which this command was applied. */
  readonly tick: number;
  /** Executed command payload. */
  readonly command: SimCommand;
}

/**
 * FIFO queue buffering external {@link SimCommand}s until the next fixed simulation tick,
 * with optional tick-stamped history recording for deterministic replay.
 */
export class CommandQueue {
  private pending: SimCommand[] = [];
  private readonly history: RecordedCommand[] = [];
  private readonly recordHistory: boolean;

  /**
   * Creates a {@link CommandQueue}.
   *
   * @param recordHistory - When `true`, records every drained command with its execution tick (default `true`).
   */
  public constructor(recordHistory = true) {
    this.recordHistory = recordHistory;
  }

  /** Number of queued commands waiting for the next tick. */
  public get pendingCount(): number {
    return this.pending.length;
  }

  /** Enqueues a command to be executed at the start of the next fixed tick. */
  public enqueue(command: SimCommand): void {
    this.pending.push(command);
  }

  /**
   * Drains all currently queued commands in FIFO order and stamps them with `tick` in history.
   */
  public drainForTick(tick: number): readonly SimCommand[] {
    if (this.pending.length === 0) return [];
    const batch = this.pending;
    this.pending = [];
    if (this.recordHistory) {
      for (const command of batch) {
        this.history.push({ tick, command });
      }
    }
    return batch;
  }

  /** Returns all previously executed commands with their tick stamps. */
  public getHistory(): readonly RecordedCommand[] {
    return this.history;
  }

  /** Clears both pending commands and recorded history. */
  public clear(): void {
    this.pending = [];
    this.history.length = 0;
  }
}
