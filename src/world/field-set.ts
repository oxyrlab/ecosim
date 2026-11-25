import { InvalidParameterError } from '@core/index';
import { GridField, type FieldBrushMode } from './field';

/**
 * Standard environmental and scent field names defined in Section 5.6.
 */
export const DEFAULT_FIELD_NAMES = Object.freeze([
  'scent.plant',
  'scent.prey',
  'scent.predator',
  'scent.corpse',
  'pheromone.mate',
  'soil.nutrients',
  'soil.moisture',
  'light',
] as const);

/**
 * Union of standard EcoSim field names.
 */
export type DefaultFieldName = (typeof DEFAULT_FIELD_NAMES)[number];

/**
 * Per-field diffusion and decay step parameters.
 */
export interface FieldDynamics {
  /** Diffusion rate in `[0, 1]` applied per diffusion step (`0` disables diffusion). */
  readonly diffusionRate: number;
  /** Retention factor in `[0, 1]` applied per diffusion step (`1` disables decay). */
  readonly retentionFactor: number;
}

/**
 * Configuration for constructing a {@link FieldSet}.
 */
export interface FieldSetConfig {
  /** Number of grid columns across the world. */
  readonly cols: number;
  /** Number of grid rows across the world. */
  readonly rows: number;
  /** Size of one square grid cell in meters. */
  readonly cellSizeMeters: number;
  /** Optional custom field dynamics overriding defaults. */
  readonly dynamics?: Readonly<Partial<Record<string, FieldDynamics>>>;
}

const DEFAULT_DYNAMICS: Readonly<Record<DefaultFieldName, FieldDynamics>> = {
  'scent.plant': { diffusionRate: 0.25, retentionFactor: 0.92 },
  'scent.prey': { diffusionRate: 0.25, retentionFactor: 0.9 },
  'scent.predator': { diffusionRate: 0.25, retentionFactor: 0.9 },
  'scent.corpse': { diffusionRate: 0.2, retentionFactor: 0.95 },
  'pheromone.mate': { diffusionRate: 0.3, retentionFactor: 0.88 },
  'soil.nutrients': { diffusionRate: 0.02, retentionFactor: 1.0 },
  'soil.moisture': { diffusionRate: 0.05, retentionFactor: 1.0 },
  light: { diffusionRate: 0, retentionFactor: 1.0 },
};

/**
 * Manages the collection of named {@link GridField} layers overlaid on a world.
 */
export class FieldSet {
  private readonly fields = new Map<string, GridField>();
  private readonly dynamics = new Map<string, FieldDynamics>();

  /**
   * Creates a {@link FieldSet} initialized with all {@link DEFAULT_FIELD_NAMES}.
   *
   * @param config - Shared grid dimensions and optional per-field dynamics.
   */
  public constructor(config: FieldSetConfig) {
    for (const name of DEFAULT_FIELD_NAMES) {
      const initialValue = name === 'light' ? 1 : name === 'soil.moisture' ? 0.5 : 0;
      const maxValue = name === 'light' || name === 'soil.moisture' ? 1 : Number.POSITIVE_INFINITY;
      this.fields.set(
        name,
        new GridField({
          name,
          cols: config.cols,
          rows: config.rows,
          cellSizeMeters: config.cellSizeMeters,
          minValue: 0,
          maxValue,
          initialValue,
        }),
      );
      const override = config.dynamics?.[name];
      this.dynamics.set(name, override ?? DEFAULT_DYNAMICS[name]);
    }
  }

  /**
   * Returns all registered field names in deterministic order.
   */
  public names(): readonly string[] {
    return Array.from(this.fields.keys());
  }

  /**
   * Returns `true` if a field with `name` exists.
   */
  public has(name: string): boolean {
    return this.fields.has(name);
  }

  /**
   * Retrieves a {@link GridField} by name.
   *
   * @param name - Field name.
   * @throws InvalidParameterError if no field with `name` exists.
   */
  public get(name: string): GridField {
    const field = this.fields.get(name);
    if (field === undefined) {
      throw new InvalidParameterError(
        'fieldName',
        name,
        `one of [${Array.from(this.fields.keys()).join(', ')}]`,
        'FieldSet.get',
      );
    }
    return field;
  }

  /**
   * Advances diffusion and decay for every field according to its configured {@link FieldDynamics}.
   */
  public stepDiffusion(): void {
    for (const [name, field] of this.fields.entries()) {
      const dyn = this.dynamics.get(name);
      if (dyn === undefined) continue;
      if (dyn.diffusionRate > 0) {
        field.diffuse(dyn.diffusionRate);
      }
      if (dyn.retentionFactor < 1) {
        field.decay(dyn.retentionFactor);
      }
    }
  }

  /**
   * Paints a circular region into a named field (used by scenarios and Sandbox brushes).
   */
  public paintField(
    name: string,
    worldX: number,
    worldY: number,
    radiusMeters: number,
    value: number,
    mode: FieldBrushMode = 'set',
  ): void {
    this.get(name).paintCircle(worldX, worldY, radiusMeters, value, mode);
  }
}
