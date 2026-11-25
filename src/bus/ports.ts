import { InvalidParameterError } from '@core/index';

/**
 * Signal representation of a channel on a creature's {@link SignalBus}.
 * - `analog`: continuous numeric value persisting across ticks until overwritten.
 * - `pulse`: one-tick event signal that automatically resets to `0` after being read.
 */
export type ChannelKind = 'analog' | 'pulse';

/**
 * Policy required when multiple outputs wire into a single input port (fan-in) or when multiple
 * modules publish to the same broadcast hormone channel.
 */
export type MergePolicy = 'sum' | 'max' | 'min' | 'avg';

/**
 * Declarative specification of a single local port on a Sensor, Actuator, BrainModule, or Spine.
 */
export interface PortDef {
  /** Signal kind (`analog` or `pulse`). */
  readonly kind: ChannelKind;
  /** Inclusive clamped value range `[min, max]`. */
  readonly range: readonly [min: number, max: number];
  /** Optional SI or semantic unit (`m`, `rad`, `EU`, `normalized`). */
  readonly unit?: string;
  /** Concise description surfaced in generated catalogs. */
  readonly description: string;
  /**
   * Element count for genuinely spatial array ports (e.g. vision sectors).
   * Omit for logical scalar ports; numeric indexing is only permitted when `count` is defined.
   */
  readonly count?: number;
  /** Required merge policy for input ports that accept fan-in from multiple sources. */
  readonly merge?: MergePolicy;
}

/**
 * Flattened port specification including its local `port` name, used for wiring and catalog docs.
 */
export interface PortSpec extends PortDef {
  /** Local port name (e.g. `sector.distance`, `move.forward`). */
  readonly port: string;
}

/**
 * Record of named local ports declared on a component definition.
 */
export type PortMap = Readonly<Record<string, PortDef>>;

/**
 * Pre-resolved numeric handle referencing one scalar port or spatial array port inside a
 * {@link SignalBus}. Used in hot loops with zero string lookups.
 */
export interface PortHandle {
  /** Starting slot index in the `SignalBus` `Float32Array`. */
  readonly offset: number;
  /** Number of contiguous slots (`1` for scalar ports, `count` for spatial arrays). */
  readonly count: number;
  /** Signal kind (`analog` or `pulse`). */
  readonly kind: ChannelKind;
  /** Inclusive value range `[min, max]`. */
  readonly range: readonly [min: number, max: number];
}

/**
 * Mapped handle lookup table matching a component's declared {@link PortMap} keys at compile time.
 */
export type PortHandleMap<T extends PortMap> = { readonly [K in keyof T]: PortHandle };

/**
 * Read-only hot-loop view over a creature's {@link SignalBus} (`current` buffer).
 */
export interface PortReader {
  /**
   * Reads the current-tick value at `handle` (and optional `index` for spatial array ports).
   */
  get(handle: PortHandle, index?: number): number;
}

/**
 * Write-only hot-loop view over a creature's {@link SignalBus} (`next` buffer).
 */
export interface PortWriter {
  /**
   * Writes `value` into the next-tick buffer at `handle` (clamped to `handle.range`).
   */
  set(handle: PortHandle, value: number, index?: number): void;
}

/**
 * Named reusable groups of ports that can be wired in a single bundle statement (Section 5.2.1).
 */
export const PORT_BUNDLES: Readonly<Record<string, PortMap>> = Object.freeze({
  behavior: Object.freeze({
    urgency: {
      kind: 'analog' as const,
      range: [0, 1] as const,
      unit: 'normalized',
      description: 'Priority urgency of this behavior proposal [0, 1].',
    },
    turn: {
      kind: 'analog' as const,
      range: [-1, 1] as const,
      unit: 'normalized',
      description: 'Desired steering command [-1 = left, +1 = right].',
    },
    forward: {
      kind: 'analog' as const,
      range: [-1, 1] as const,
      unit: 'normalized',
      description: 'Desired forward thrust command [-1 = reverse, +1 = full forward].',
    },
  }),
});

/**
 * Options for declaring an analog or pulse port via the {@link port} builder.
 */
export interface PortBuilderOptions {
  readonly range?: readonly [min: number, max: number];
  readonly unit?: string;
  readonly description: string;
  readonly count?: number;
  readonly merge?: MergePolicy;
}

function validatePortOptions(kind: ChannelKind, options: PortBuilderOptions): PortDef {
  const range = options.range ?? ([0, 1] as const);
  const [min, max] = range;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new InvalidParameterError(
      'range',
      range,
      'finite bounds with min <= max',
      `port.${kind}`,
    );
  }
  if (options.count !== undefined && (!Number.isInteger(options.count) || options.count < 1)) {
    throw new InvalidParameterError('count', options.count, 'an integer >= 1', `port.${kind}`);
  }
  if (options.description.trim().length === 0) {
    throw new InvalidParameterError(
      'description',
      options.description,
      'a non-empty port description',
      `port.${kind}`,
    );
  }
  return {
    kind,
    range,
    description: options.description,
    ...(options.unit !== undefined ? { unit: options.unit } : {}),
    ...(options.count !== undefined ? { count: options.count } : {}),
    ...(options.merge !== undefined ? { merge: options.merge } : {}),
  };
}

/**
 * Typed builder helpers for declaring component ports (`port.analog`, `port.pulse`, `port.bundle`).
 */
export const port = Object.freeze({
  /** Declares a continuous `analog` port (default range `[0, 1]`). */
  analog(options: PortBuilderOptions): PortDef {
    return validatePortOptions('analog', options);
  },

  /** Declares a one-tick `pulse` port that resets to `0` after being read (default range `[0, 1]`). */
  pulse(options: PortBuilderOptions): PortDef {
    return validatePortOptions('pulse', options);
  },

  /**
   * Expands a named {@link PORT_BUNDLES} entry into prefixed ports (e.g. `port.bundle('behavior', 'flee')`
   * produces `flee.urgency`, `flee.turn`, `flee.forward`), or unprefixed if `prefix` is omitted.
   */
  bundle(bundleName: string, prefix?: string, merge?: MergePolicy): PortMap {
    const bundle = PORT_BUNDLES[bundleName];
    if (bundle === undefined) {
      throw new InvalidParameterError(
        'bundleName',
        bundleName,
        `one of [${Object.keys(PORT_BUNDLES).join(', ')}]`,
        'port.bundle',
      );
    }
    const expanded: Record<string, PortDef> = {};
    for (const [key, def] of Object.entries(bundle)) {
      const fullName = prefix !== undefined && prefix.length > 0 ? `${prefix}.${key}` : key;
      expanded[fullName] = merge !== undefined ? { ...def, merge } : { ...def };
    }
    return expanded;
  },
});

/**
 * Converts a {@link PortMap} record into a flat deterministic list of {@link PortSpec}s.
 */
export function portMapToSpecs(ports: PortMap): PortSpec[] {
  return Object.entries(ports).map(([name, def]) => ({ port: name, ...def }));
}
