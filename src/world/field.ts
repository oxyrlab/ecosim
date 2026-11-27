import { assertFiniteNumber, InvalidParameterError } from '@core/index';

/**
 * Mode for painting values into a {@link GridField} via a circular brush.
 */
export type FieldBrushMode = 'set' | 'add';

/**
 * Discrete grid cell coordinates `(col, row)`.
 */
export interface GridCell {
  /** Zero-based column index (`0 <= col < cols`). */
  readonly col: number;
  /** Zero-based row index (`0 <= row < rows`). */
  readonly row: number;
}

/**
 * Configuration for constructing a {@link GridField}.
 */
export interface GridFieldConfig {
  /** Field identifier (e.g. `scent.plant`, `soil.nutrients`). */
  readonly name: string;
  /** Number of grid columns (>= 1). */
  readonly cols: number;
  /** Number of grid rows (>= 1). */
  readonly rows: number;
  /** Width and height of one square cell in meters (> 0). */
  readonly cellSizeMeters: number;
  /** Minimum clamped cell value (default `0`). */
  readonly minValue?: number;
  /** Optional maximum clamped cell value (default `Infinity`). */
  readonly maxValue?: number;
  /** Optional initial uniform fill value (default `0`). */
  readonly initialValue?: number;
}

/**
 * 2D scalar field stored on double-buffered `Float32Array`s (`current` and `scratch`).
 * Supports mass-conserving 3x3 diffusion, exponential decay, bilinear interpolation,
 * and circular brush painting for Sandbox editing.
 */
export class GridField {
  /** Field identifier. */
  public readonly name: string;
  /** Number of columns. */
  public readonly cols: number;
  /** Number of rows. */
  public readonly rows: number;
  /** Cell size in SI meters. */
  public readonly cellSizeMeters: number;
  /** Total world width covered by this field in meters. */
  public readonly widthMeters: number;
  /** Total world height covered by this field in meters. */
  public readonly heightMeters: number;
  /** Lower clamp bound for cell values. */
  public readonly minValue: number;
  /** Upper clamp bound for cell values. */
  public readonly maxValue: number;

  private current: Float32Array;
  private scratch: Float32Array;

  /**
   * Creates a {@link GridField}.
   *
   * @param config - Dimensions, cell size in meters, and optional clamps/initial value.
   * @throws InvalidParameterError if dimensions, cell size, or bounds are invalid.
   */
  public constructor(config: GridFieldConfig) {
    if (config.name.trim().length === 0) {
      throw new InvalidParameterError('name', config.name, 'a non-empty field name', 'GridField');
    }
    if (!Number.isInteger(config.cols) || config.cols < 1) {
      throw new InvalidParameterError('cols', config.cols, 'an integer >= 1', 'GridField');
    }
    if (!Number.isInteger(config.rows) || config.rows < 1) {
      throw new InvalidParameterError('rows', config.rows, 'an integer >= 1', 'GridField');
    }
    if (!Number.isFinite(config.cellSizeMeters) || config.cellSizeMeters <= 0) {
      throw new InvalidParameterError(
        'cellSizeMeters',
        config.cellSizeMeters,
        'a finite number > 0',
        'GridField',
      );
    }

    const minValue = config.minValue ?? 0;
    const maxValue = config.maxValue ?? Number.POSITIVE_INFINITY;
    if (Number.isNaN(minValue) || Number.isNaN(maxValue) || minValue > maxValue) {
      throw new InvalidParameterError(
        'bounds',
        [minValue, maxValue],
        'non-NaN bounds with minValue <= maxValue',
        'GridField',
      );
    }

    const initialValue = config.initialValue ?? 0;
    assertFiniteNumber('initialValue', initialValue, 'GridField');

    this.name = config.name;
    this.cols = config.cols;
    this.rows = config.rows;
    this.cellSizeMeters = config.cellSizeMeters;
    this.widthMeters = config.cols * config.cellSizeMeters;
    this.heightMeters = config.rows * config.cellSizeMeters;
    this.minValue = minValue;
    this.maxValue = maxValue;

    const length = config.cols * config.rows;
    this.current = new Float32Array(length);
    this.scratch = new Float32Array(length);
    if (initialValue !== 0) {
      this.fill(initialValue);
    }
  }

  /**
   * Read-only view of the underlying `Float32Array` buffer (row-major: `row * cols + col`).
   */
  public get data(): Float32Array {
    return this.current;
  }

  /**
   * Converts world coordinates `(x, y)` in meters to discrete cell coordinates, returning `null`
   * when outside `[0, widthMeters) x [0, heightMeters)`.
   */
  public worldToCell(x: number, y: number): GridCell | null {
    const col = Math.floor(x / this.cellSizeMeters);
    const row = Math.floor(y / this.cellSizeMeters);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return null;
    }
    return { col, row };
  }

  /**
   * Reads the value at `(col, row)`, returning `0` when out of bounds.
   */
  public getCell(col: number, row: number): number {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0;
    return this.current[row * this.cols + col] ?? 0;
  }

  /**
   * Sets the value at `(col, row)` (clamped to `[minValue, maxValue]`). Out-of-bounds writes are ignored.
   */
  public setCell(col: number, row: number, value: number): void {
    assertFiniteNumber('value', value, `GridField(${this.name}).setCell`);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    this.current[row * this.cols + col] = this.clampValue(value);
  }

  /**
   * Adds `delta` to the cell at `(col, row)` (clamped to `[minValue, maxValue]`).
   */
  public addCell(col: number, row: number, delta: number): void {
    assertFiniteNumber('delta', delta, `GridField(${this.name}).addCell`);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const idx = row * this.cols + col;
    const prev = this.current[idx] ?? 0;
    this.current[idx] = this.clampValue(prev + delta);
  }

  /**
   * Adds `delta` to the cell containing world point `(x, y)` in meters.
   */
  public addAtWorld(x: number, y: number, delta: number): void {
    const col = Math.floor(x / this.cellSizeMeters);
    const row = Math.floor(y / this.cellSizeMeters);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    this.addCell(col, row, delta);
  }

  /**
   * Applies a circular brush centered at `(worldX, worldY)` with `radiusMeters`, modifying every
   * cell whose center falls inside the circle. Used by both scenario setup and Sandbox UI brushes.
   *
   * @param worldX - Brush center X in meters.
   * @param worldY - Brush center Y in meters.
   * @param radiusMeters - Non-negative brush radius in meters.
   * @param value - Value to set or add.
   * @param mode - `'set'` overwrites cells; `'add'` increments them.
   */
  public paintCircle(
    worldX: number,
    worldY: number,
    radiusMeters: number,
    value: number,
    mode: FieldBrushMode = 'set',
  ): void {
    assertFiniteNumber('worldX', worldX, 'GridField.paintCircle');
    assertFiniteNumber('worldY', worldY, 'GridField.paintCircle');
    assertFiniteNumber('value', value, 'GridField.paintCircle');
    if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
      throw new InvalidParameterError(
        'radiusMeters',
        radiusMeters,
        'a finite number >= 0',
        'GridField.paintCircle',
      );
    }

    const minCol = Math.max(0, Math.floor((worldX - radiusMeters) / this.cellSizeMeters));
    const maxCol = Math.min(
      this.cols - 1,
      Math.floor((worldX + radiusMeters) / this.cellSizeMeters),
    );
    const minRow = Math.max(0, Math.floor((worldY - radiusMeters) / this.cellSizeMeters));
    const maxRow = Math.min(
      this.rows - 1,
      Math.floor((worldY + radiusMeters) / this.cellSizeMeters),
    );
    const radiusSq = radiusMeters * radiusMeters;

    for (let row = minRow; row <= maxRow; row += 1) {
      const cy = (row + 0.5) * this.cellSizeMeters;
      const dy = cy - worldY;
      for (let col = minCol; col <= maxCol; col += 1) {
        const cx = (col + 0.5) * this.cellSizeMeters;
        const dx = cx - worldX;
        if (dx * dx + dy * dy <= radiusSq) {
          if (mode === 'set') {
            this.setCell(col, row, value);
          } else {
            this.addCell(col, row, value);
          }
        }
      }
    }
  }

  /**
   * Samples the field smoothly at `(worldX, worldY)` meters using bilinear interpolation across
   * neighboring cell centers (clamped at grid borders).
   */
  public sampleBilinear(worldX: number, worldY: number): number {
    const gx = worldX / this.cellSizeMeters - 0.5;
    const gy = worldY / this.cellSizeMeters - 0.5;

    const x0 = Math.max(0, Math.min(this.cols - 1, Math.floor(gx)));
    const y0 = Math.max(0, Math.min(this.rows - 1, Math.floor(gy)));
    const x1 = Math.min(this.cols - 1, x0 + 1);
    const y1 = Math.min(this.rows - 1, y0 + 1);

    const tx = Math.max(0, Math.min(1, gx - x0));
    const ty = Math.max(0, Math.min(1, gy - y0));

    const cols = this.cols;
    const buf = this.current;
    const v00 = buf[y0 * cols + x0] as number;
    const v10 = buf[y0 * cols + x1] as number;
    const v01 = buf[y1 * cols + x0] as number;
    const v11 = buf[y1 * cols + x1] as number;

    const top = v00 + (v10 - v00) * tx;
    const bottom = v01 + (v11 - v01) * tx;
    return top + (bottom - top) * ty;
  }

  /**
   * Runs one step of mass-conserving 3x3 isotropic diffusion with zero-flux reflective boundaries.
   * Uses a symmetric 8-neighbor kernel (orthogonal weight `1/6`, diagonal weight `1/12`, summing
   * to `1`), so for any `rate` in `[0, 1]` total mass is conserved without allocations.
   *
   * @param rate - Fraction of each cell's mass shared with neighbors in `[0, 1]`.
   * @throws InvalidParameterError if `rate` is outside `[0, 1]`.
   */
  public diffuse(rate: number): void {
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      throw new InvalidParameterError(
        'rate',
        rate,
        'a finite number in [0, 1]',
        'GridField.diffuse',
      );
    }
    if (rate === 0) return;

    const cols = this.cols;
    const rows = this.rows;
    const src = this.current;
    const dst = this.scratch;
    const stay = 1 - rate;
    const ortho = rate / 6;
    const diag = rate / 12;

    for (let row = 0; row < rows; row += 1) {
      const rUp = row > 0 ? row - 1 : 0;
      const rDown = row + 1 < rows ? row + 1 : rows - 1;
      const rowOffset = row * cols;
      const upOffset = rUp * cols;
      const downOffset = rDown * cols;

      for (let col = 0; col < cols; col += 1) {
        const cLeft = col > 0 ? col - 1 : 0;
        const cRight = col + 1 < cols ? col + 1 : cols - 1;

        const center = src[rowOffset + col] as number;
        const orthoSum =
          (src[upOffset + col] as number) +
          (src[downOffset + col] as number) +
          (src[rowOffset + cLeft] as number) +
          (src[rowOffset + cRight] as number);
        const diagSum =
          (src[upOffset + cLeft] as number) +
          (src[upOffset + cRight] as number) +
          (src[downOffset + cLeft] as number) +
          (src[downOffset + cRight] as number);

        dst[rowOffset + col] = center * stay + orthoSum * ortho + diagSum * diag;
      }
    }

    // Swap double buffers without allocation.
    this.current = dst;
    this.scratch = src;
  }

  /**
   * Multiplies every cell by `retentionFactor` (`0 <= retentionFactor <= 1`).
   *
   * @param retentionFactor - Multiplier kept per step (e.g. `0.95` decays 5% per step).
   */
  public decay(retentionFactor: number): void {
    if (!Number.isFinite(retentionFactor) || retentionFactor < 0 || retentionFactor > 1) {
      throw new InvalidParameterError(
        'retentionFactor',
        retentionFactor,
        'a finite number in [0, 1]',
        'GridField.decay',
      );
    }
    const buf = this.current;
    for (let i = 0; i < buf.length; i += 1) {
      buf[i] = (buf[i] ?? 0) * retentionFactor;
    }
  }

  /**
   * Returns the sum of all cell values across the field (useful for conservation checks).
   */
  public totalMass(): number {
    let sum = 0;
    const buf = this.current;
    for (let i = 0; i < buf.length; i += 1) {
      sum += buf[i] ?? 0;
    }
    return sum;
  }

  /**
   * Fills every cell with `value` (clamped to `[minValue, maxValue]`).
   */
  public fill(value: number): void {
    assertFiniteNumber('value', value, `GridField(${this.name}).fill`);
    this.current.fill(this.clampValue(value));
  }

  /**
   * Resets every cell to `0` (or `minValue` if `minValue > 0`).
   */
  public clear(): void {
    this.current.fill(this.clampValue(0));
  }

  private clampValue(value: number): number {
    if (value < this.minValue) return this.minValue;
    if (value > this.maxValue) return this.maxValue;
    return value;
  }
}
