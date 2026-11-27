import { assertFiniteNumber, InvalidParameterError, type EntityId } from '@core/index';

interface SpatialEntry {
  readonly entity: EntityId;
  x: number;
  y: number;
  radius: number;
  minCx: number;
  maxCx: number;
  minCy: number;
  maxCy: number;
  lastQueryStamp: number;
}

const CELL_OFFSET = 0x100000;
const CELL_STRIDE = 0x200000;

function packCellKey(cx: number, cy: number): number {
  return (cx + CELL_OFFSET) * CELL_STRIDE + (cy + CELL_OFFSET);
}

/**
 * Uniform-grid spatial index for fast radius and AABB neighbor queries in SI meters,
 * independent of Rapier. Uses integer-packed cell keys, direct entry buckets, in-place
 * same-cell updates, and monotonic query stamps for zero-allocation deduplication.
 * All query methods return entities in deterministic ascending {@link EntityId} order.
 */
export class SpatialHash {
  /** Cell edge length in meters. */
  public readonly cellSizeMeters: number;

  private readonly invCellSize: number;
  private readonly entries = new Map<EntityId, SpatialEntry>();
  private readonly cells = new Map<number, SpatialEntry[]>();
  private queryStamp = 0;

  /**
   * Creates a {@link SpatialHash}.
   *
   * @param cellSizeMeters - Positive finite cell width/height in meters (default `2`).
   * @throws InvalidParameterError if `cellSizeMeters` is not a positive finite number.
   */
  public constructor(cellSizeMeters = 2) {
    if (!Number.isFinite(cellSizeMeters) || cellSizeMeters <= 0) {
      throw new InvalidParameterError(
        'cellSizeMeters',
        cellSizeMeters,
        'a finite number > 0',
        'SpatialHash',
      );
    }
    this.cellSizeMeters = cellSizeMeters;
    this.invCellSize = 1 / cellSizeMeters;
  }

  /** Number of currently indexed entities. */
  public get size(): number {
    return this.entries.size;
  }

  /**
   * Inserts or updates an entity's position `(x, y)` and bounding `radius` (meters).
   */
  public insert(entity: EntityId, x: number, y: number, radius = 0): void {
    assertFiniteNumber('x', x, 'SpatialHash.insert');
    assertFiniteNumber('y', y, 'SpatialHash.insert');
    if (!Number.isFinite(radius) || radius < 0) {
      throw new InvalidParameterError(
        'radius',
        radius,
        'a finite number >= 0',
        'SpatialHash.insert',
      );
    }

    const inv = this.invCellSize;
    const minCx = Math.floor((x - radius) * inv);
    const maxCx = Math.floor((x + radius) * inv);
    const minCy = Math.floor((y - radius) * inv);
    const maxCy = Math.floor((y + radius) * inv);

    const existing = this.entries.get(entity);
    if (existing !== undefined) {
      // Fast path: entity remained inside the exact same grid cell range.
      if (
        existing.minCx === minCx &&
        existing.maxCx === maxCx &&
        existing.minCy === minCy &&
        existing.maxCy === maxCy
      ) {
        existing.x = x;
        existing.y = y;
        existing.radius = radius;
        return;
      }
      this.removeFromCells(existing);
      existing.x = x;
      existing.y = y;
      existing.radius = radius;
      existing.minCx = minCx;
      existing.maxCx = maxCx;
      existing.minCy = minCy;
      existing.maxCy = maxCy;
      this.addToCells(existing);
      return;
    }

    const entry: SpatialEntry = {
      entity,
      x,
      y,
      radius,
      minCx,
      maxCx,
      minCy,
      maxCy,
      lastQueryStamp: 0,
    };
    this.entries.set(entity, entry);
    this.addToCells(entry);
  }

  /**
   * Alias for {@link insert} when updating an existing entity's spatial bounds.
   */
  public update(entity: EntityId, x: number, y: number, radius = 0): void {
    this.insert(entity, x, y, radius);
  }

  /**
   * Removes an entity from the index. Removing an absent entity is a no-op.
   */
  public remove(entity: EntityId): void {
    const entry = this.entries.get(entity);
    if (entry === undefined) return;
    this.entries.delete(entity);
    this.removeFromCells(entry);
  }

  /**
   * Returns all indexed entities whose bounding circle intersects the query circle centered at
   * `(x, y)` with radius `radiusMeters`, sorted in ascending {@link EntityId} order.
   */
  public queryRadius(x: number, y: number, radiusMeters: number): EntityId[] {
    assertFiniteNumber('x', x, 'SpatialHash.queryRadius');
    assertFiniteNumber('y', y, 'SpatialHash.queryRadius');
    if (!Number.isFinite(radiusMeters) || radiusMeters < 0) {
      throw new InvalidParameterError(
        'radiusMeters',
        radiusMeters,
        'a finite number >= 0',
        'SpatialHash.queryRadius',
      );
    }

    const inv = this.invCellSize;
    const padX = radiusMeters + Math.max(1e-9, Math.abs(x) * 1e-12);
    const padY = radiusMeters + Math.max(1e-9, Math.abs(y) * 1e-12);
    const minCx = Math.floor((x - padX) * inv);
    const maxCx = Math.floor((x + padX) * inv);
    const minCy = Math.floor((y - padY) * inv);
    const maxCy = Math.floor((y + padY) * inv);

    const stamp = this.nextQueryStamp();
    const results: EntityId[] = [];
    let prevId = -1;
    let needsSort = false;

    for (let cy = minCy; cy <= maxCy; cy += 1) {
      const yPart = cy + CELL_OFFSET;
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        const bucket = this.cells.get((cx + CELL_OFFSET) * CELL_STRIDE + yPart);
        if (bucket === undefined) continue;
        for (let i = 0; i < bucket.length; i += 1) {
          const entry = bucket[i] as SpatialEntry;
          if (entry.lastQueryStamp === stamp) continue;
          entry.lastQueryStamp = stamp;
          const dx = entry.x - x;
          const dy = entry.y - y;
          const maxDist = radiusMeters + entry.radius;
          if (dx * dx + dy * dy <= maxDist * maxDist) {
            const id = entry.entity;
            if (id < prevId) needsSort = true;
            prevId = id;
            results.push(id);
          }
        }
      }
    }

    if (needsSort) {
      results.sort((a, b) => a - b);
    }
    return results;
  }

  /**
   * Returns all indexed entities whose bounding boxes overlap `[minX, maxX] x [minY, maxY]`
   * in ascending {@link EntityId} order.
   */
  public queryRect(minX: number, minY: number, maxX: number, maxY: number): EntityId[] {
    assertFiniteNumber('minX', minX, 'SpatialHash.queryRect');
    assertFiniteNumber('minY', minY, 'SpatialHash.queryRect');
    assertFiniteNumber('maxX', maxX, 'SpatialHash.queryRect');
    assertFiniteNumber('maxY', maxY, 'SpatialHash.queryRect');
    if (minX > maxX || minY > maxY) {
      throw new InvalidParameterError(
        'rect',
        [minX, minY, maxX, maxY],
        'bounds with minX <= maxX and minY <= maxY',
        'SpatialHash.queryRect',
      );
    }

    const inv = this.invCellSize;
    const minCx = Math.floor(minX * inv);
    const maxCx = Math.floor(maxX * inv);
    const minCy = Math.floor(minY * inv);
    const maxCy = Math.floor(maxY * inv);

    const stamp = this.nextQueryStamp();
    const results: EntityId[] = [];
    let prevId = -1;
    let needsSort = false;

    for (let cy = minCy; cy <= maxCy; cy += 1) {
      const yPart = cy + CELL_OFFSET;
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        const bucket = this.cells.get((cx + CELL_OFFSET) * CELL_STRIDE + yPart);
        if (bucket === undefined) continue;
        for (let i = 0; i < bucket.length; i += 1) {
          const entry = bucket[i] as SpatialEntry;
          if (entry.lastQueryStamp === stamp) continue;
          entry.lastQueryStamp = stamp;
          if (
            entry.x + entry.radius >= minX &&
            entry.x - entry.radius <= maxX &&
            entry.y + entry.radius >= minY &&
            entry.y - entry.radius <= maxY
          ) {
            const id = entry.entity;
            if (id < prevId) needsSort = true;
            prevId = id;
            results.push(id);
          }
        }
      }
    }

    if (needsSort) {
      results.sort((a, b) => a - b);
    }
    return results;
  }

  /** Clears all entries and buckets. */
  public clear(): void {
    this.entries.clear();
    this.cells.clear();
    this.queryStamp = 0;
  }

  private nextQueryStamp(): number {
    this.queryStamp += 1;
    if (this.queryStamp >= 0x7fffffff) {
      this.queryStamp = 1;
      for (const entry of this.entries.values()) {
        entry.lastQueryStamp = 0;
      }
    }
    return this.queryStamp;
  }

  private addToCells(entry: SpatialEntry): void {
    for (let cy = entry.minCy; cy <= entry.maxCy; cy += 1) {
      for (let cx = entry.minCx; cx <= entry.maxCx; cx += 1) {
        const key = packCellKey(cx, cy);
        let bucket = this.cells.get(key);
        if (bucket === undefined) {
          bucket = [];
          this.cells.set(key, bucket);
        }
        bucket.push(entry);
      }
    }
  }

  private removeFromCells(entry: SpatialEntry): void {
    for (let cy = entry.minCy; cy <= entry.maxCy; cy += 1) {
      for (let cx = entry.minCx; cx <= entry.maxCx; cx += 1) {
        const key = packCellKey(cx, cy);
        const bucket = this.cells.get(key);
        if (bucket === undefined) continue;
        const idx = bucket.indexOf(entry);
        if (idx !== -1) {
          const last = bucket.pop() as SpatialEntry;
          if (idx < bucket.length) {
            bucket[idx] = last;
          }
        }
        if (bucket.length === 0) {
          this.cells.delete(key);
        }
      }
    }
  }
}
