import { assertFiniteNumber, InvalidParameterError } from '@core/index';
import type { ChannelKind, MergePolicy, PortHandle, PortReader, PortWriter } from './ports';

/**
 * Metadata describing a single numeric slot in a creature's {@link SignalBus}.
 */
export interface ChannelSpec {
  /** Dotted channel name (e.g. `eye-left.vision.sector.3.distance`, `motor.move.forward`). */
  readonly name: string;
  /** `analog` (persistent continuous) or `pulse` (auto-resetting one-tick event). */
  readonly kind: ChannelKind;
  /** Inclusive clamped value bounds `[min, max]`. */
  readonly range: readonly [min: number, max: number];
  /** Optional SI or semantic unit. */
  readonly unit?: string;
  /** Description for Inspector and catalog diagnostics. */
  readonly description: string;
}

/**
 * Pre-resolved zero-allocation merge step executed during {@link SignalBus.swap} for fan-in ports
 * and multi-publisher broadcast hormones.
 */
export interface MergeOp {
  /** Source channel indices to combine from the `next` buffer. */
  readonly sources: readonly number[];
  /** Destination channel index written in the `next` buffer. */
  readonly target: number;
  /** Merge aggregation policy (`sum`, `max`, `min`, or `avg`). */
  readonly policy: MergePolicy;
}

/**
 * Per-creature double-buffered (`current` / `next`) `Float32Array` signal carrier (ADR 0004).
 * Reads come exclusively from `current`; writes go to `next`; `swap()` commits merges, swaps
 * buffers, carries analog values forward, and resets pulse slots to `0`.
 */
export class SignalBus {
  /** Metadata for every allocated channel slot. */
  public readonly specs: readonly ChannelSpec[];
  /** Hot-loop reader backed by `current`. */
  public readonly reader: PortReader;
  /** Hot-loop writer backed by `next`. */
  public readonly writer: PortWriter;

  private current: Float32Array;
  private next: Float32Array;
  private readonly minValues: Float32Array;
  private readonly maxValues: Float32Array;
  private readonly isPulse: Uint8Array;
  private readonly mergeOps: readonly MergeOp[];

  /**
   * Creates a {@link SignalBus} with fixed capacity `specs.length` (no further allocations in hot loops).
   */
  public constructor(specs: readonly ChannelSpec[], mergeOps: readonly MergeOp[] = []) {
    const count = specs.length;
    this.specs = specs;
    this.mergeOps = mergeOps;
    this.current = new Float32Array(count);
    this.next = new Float32Array(count);
    this.minValues = new Float32Array(count);
    this.maxValues = new Float32Array(count);
    this.isPulse = new Uint8Array(count);

    for (let i = 0; i < count; i += 1) {
      const spec = specs[i] as ChannelSpec;
      const [min, max] = spec.range;
      this.minValues[i] = min;
      this.maxValues[i] = max;
      this.isPulse[i] = spec.kind === 'pulse' ? 1 : 0;
      const initVal = min <= 0 && max >= 0 ? 0 : min;
      this.current[i] = initVal;
      this.next[i] = initVal;
    }

    this.reader = {
      get: (handle: PortHandle, index = 0): number => {
        if (index < 0 || index >= handle.count) {
          throw new InvalidParameterError(
            'index',
            index,
            `an integer in [0, ${handle.count - 1}]`,
            'SignalBus.reader.get',
          );
        }
        return this.current[handle.offset + index] as number;
      },
    };

    this.writer = {
      set: (handle: PortHandle, value: number, index = 0): void => {
        if (index < 0 || index >= handle.count) {
          throw new InvalidParameterError(
            'index',
            index,
            `an integer in [0, ${handle.count - 1}]`,
            'SignalBus.writer.set',
          );
        }
        this.writeIndex(handle.offset + index, value);
      },
    };
  }

  /** Number of scalar channels allocated on this bus. */
  public get channelCount(): number {
    return this.specs.length;
  }

  /** Reads the current-tick value at numeric slot `index`. */
  public readIndex(index: number): number {
    if (index < 0 || index >= this.current.length) {
      throw new InvalidParameterError(
        'index',
        index,
        `an integer in [0, ${this.current.length - 1}]`,
        'SignalBus.readIndex',
      );
    }
    return this.current[index] as number;
  }

  /** Writes `value` into the next-tick buffer at numeric slot `index`, clamping to declared bounds. */
  public writeIndex(index: number, value: number): void {
    if (index < 0 || index >= this.next.length) {
      throw new InvalidParameterError(
        'index',
        index,
        `an integer in [0, ${this.next.length - 1}]`,
        'SignalBus.writeIndex',
      );
    }
    assertFiniteNumber('value', value, 'SignalBus.writeIndex');
    const min = this.minValues[index] as number;
    const max = this.maxValues[index] as number;
    if (value < min) {
      this.next[index] = min;
    } else if (value > max) {
      this.next[index] = max;
    } else {
      this.next[index] = value;
    }
  }

  /**
   * Executes all fan-in / hormone merges on `next`, swaps `current` and `next`, carries `analog`
   * channels forward so lower-rate components hold their last output, and resets `pulse` slots in
   * `next` to `0`. Zero allocations.
   */
  public swap(): void {
    const nextBuf = this.next;
    for (let m = 0; m < this.mergeOps.length; m += 1) {
      const op = this.mergeOps[m] as MergeOp;
      const sources = op.sources;
      if (sources.length === 0) continue;

      let acc = nextBuf[sources[0] as number] as number;
      if (op.policy === 'sum' || op.policy === 'avg') {
        for (let i = 1; i < sources.length; i += 1) {
          acc += nextBuf[sources[i] as number] as number;
        }
        if (op.policy === 'avg') {
          acc /= sources.length;
        }
      } else if (op.policy === 'max') {
        for (let i = 1; i < sources.length; i += 1) {
          const v = nextBuf[sources[i] as number] as number;
          if (v > acc) acc = v;
        }
      } else {
        for (let i = 1; i < sources.length; i += 1) {
          const v = nextBuf[sources[i] as number] as number;
          if (v < acc) acc = v;
        }
      }

      const min = this.minValues[op.target] as number;
      const max = this.maxValues[op.target] as number;
      nextBuf[op.target] = acc < min ? min : acc > max ? max : acc;
    }

    // Swap current <-> next
    const prevCurrent = this.current;
    this.current = this.next;
    this.next = prevCurrent;

    // Prepare next buffer: carry analog channels forward, reset pulse channels to 0.
    const cur = this.current;
    const nxt = this.next;
    const pulseMask = this.isPulse;
    for (let i = 0; i < cur.length; i += 1) {
      nxt[i] = pulseMask[i] === 1 ? 0 : (cur[i] as number);
    }
  }

  /**
   * Returns a name-keyed snapshot of `current` values for Inspector UI and debugging (outside hot loop).
   */
  public snapshot(): Readonly<Record<string, number>> {
    const out: Record<string, number> = {};
    for (let i = 0; i < this.specs.length; i += 1) {
      const spec = this.specs[i] as ChannelSpec;
      out[spec.name] = this.current[i] as number;
    }
    return out;
  }
}
