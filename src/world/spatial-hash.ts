import { assertFiniteNumber, InvalidParameterError, type EntityId } from '@core/index';

interface SpatialEntry {
  readonly entity: EntityId;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly minCx: number;
  readonly maxCx: number;
  readonly minCy: number;
  readonly maxCy: number;
}

/**
 * Uniform-grid spatial index for fast radius and AABB neighbor queries in SI meters,
 * independent of Rapier. All query methods return entities in deterministic ascending
 * {@link EntityId} order.
 */
export class SpatialHash {
  /** Cell edge length in meters. */
  public readonly cellSizeMeters: number;

  private readonly entries = new Map<EntityId, SpatialEntry>();
  private readonly cells = new Map<string, Set<EntityId>>();

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

    if (this.entries.has(entity)) {
      this.remove(entity);
    }

    const minCx = Math.floor((x - radius) / this.cellSizeMeters);
    const maxCx = Math.floor((x + radius) / this.cellSizeMeters);
    const minCy = Math.floor((y - radius) / this.cellSizeMeters);
    const maxCy = Math.floor((y + radius) / this.cellSizeMeters);

    const entry: SpatialEntry = { entity, x, y, radius, minCx, maxCx, minCy, maxCy };
    this.entries.set(entity, entry);

    for (let cy = minCy; cy <= maxCy; cy += 1) {
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        const key = `${cx},${cy}`;
        let bucket = this.cells.get(key);
        if (bucket === undefined) {
          bucket = new Set<EntityId>();
          this.cells.set(key, bucket);
        }
        bucket.add(entity);
      }
    }
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

    for (let cy = entry.minCy; cy <= entry.maxCy; cy += 1) {
      for (let cx = entry.minCx; cx <= entry.maxCx; cx += 1) {
        const key = `${cx},${cy}`;
        const bucket = this.cells.get(key);
        if (bucket === undefined) continue;
        bucket.delete(entity);
        if (bucket.size === 0) {
          this.cells.delete(key);
        }
      }
    }
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

    // Pad cell bounds slightly so subnormal/floating-point boundary queries still inspect adjacent cells.
    const padX = radiusMeters + Math.max(1e-9, Math.abs(x) * 1e-12);
    const padY = radiusMeters + Math.max(1e-9, Math.abs(y) * 1e-12);
    const minCx = Math.floor((x - padX) / this.cellSizeMeters);
    const maxCx = Math.floor((x + padX) / this.cellSizeMeters);
    const minCy = Math.floor((y - padY) / this.cellSizeMeters);
    const maxCy = Math.floor((y + padY) / this.cellSizeMeters);

    const seen = new Set<EntityId>();
    const results: EntityId[] = [];

    for (let cy = minCy; cy <= maxCy; cy += 1) {
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        const bucket = this.cells.get(`${cx},${cy}`);
        if (bucket === undefined) continue;
        for (const entity of bucket) {
          if (seen.has(entity)) continue;
          seen.add(entity);
          const entry = this.entries.get(entity);
          if (entry === undefined) continue;
          const dx = entry.x - x;
          const dy = entry.y - y;
          const maxDist = radiusMeters + entry.radius;
          if (dx * dx + dy * dy <= maxDist * maxDist) {
            results.push(entity);
          }
        }
      }
    }

    results.sort((a, b) => a - b);
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

    const minCx = Math.floor(minX / this.cellSizeMeters);
    const maxCx = Math.floor(maxX / this.cellSizeMeters);
    const minCy = Math.floor(minY / this.cellSizeMeters);
    const maxCy = Math.floor(maxY / this.cellSizeMeters);

    const seen = new Set<EntityId>();
    const results: EntityId[] = [];

    for (let cy = minCy; cy <= maxCy; cy += 1) {
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        const bucket = this.cells.get(`${cx},${cy}`);
        if (bucket === undefined) continue;
        for (const entity of bucket) {
          if (seen.has(entity)) continue;
          seen.add(entity);
          const entry = this.entries.get(entity);
          if (entry === undefined) continue;
          if (
            entry.x + entry.radius >= minX &&
            entry.x - entry.radius <= maxX &&
            entry.y + entry.radius >= minY &&
            entry.y - entry.radius <= maxY
          ) {
            results.push(entity);
          }
        }
      }
    }

    results.sort((a, b) => a - b);
    return results;
  }

  /** Clears all entries and buckets. */
  public clear(): void {
    this.entries.clear();
    this.cells.clear();
  }
}
