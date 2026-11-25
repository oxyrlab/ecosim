import { assertFiniteNumber, InvalidParameterError, type Vec2 } from '@core/index';

/**
 * Axis-aligned world bounds visible through a {@link Camera} in SI meters.
 */
export interface WorldBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Pure 2D top-down camera converting between SI world meters and screen pixels, with viewport
 * culling helpers. Independent of PixiJS so it is fully unit-testable in Node.js.
 */
export class Camera {
  /** World X coordinate at the center of the viewport in meters. */
  public centerX: number;
  /** World Y coordinate at the center of the viewport in meters. */
  public centerY: number;
  /** Scale in pixels per meter (> 0). */
  public pixelsPerMeter: number;
  /** Viewport width in CSS pixels (> 0). */
  public viewportWidth: number;
  /** Viewport height in CSS pixels (> 0). */
  public viewportHeight: number;

  /**
   * Creates a {@link Camera}.
   *
   * @param options - Initial camera center (meters), zoom (`pixelsPerMeter`), and viewport dimensions.
   */
  public constructor(options: {
    readonly centerX: number;
    readonly centerY: number;
    readonly pixelsPerMeter: number;
    readonly viewportWidth: number;
    readonly viewportHeight: number;
  }) {
    assertFiniteNumber('centerX', options.centerX, 'Camera');
    assertFiniteNumber('centerY', options.centerY, 'Camera');
    if (!Number.isFinite(options.pixelsPerMeter) || options.pixelsPerMeter <= 0) {
      throw new InvalidParameterError(
        'pixelsPerMeter',
        options.pixelsPerMeter,
        'a finite number > 0',
        'Camera',
      );
    }
    if (!Number.isFinite(options.viewportWidth) || options.viewportWidth <= 0) {
      throw new InvalidParameterError(
        'viewportWidth',
        options.viewportWidth,
        'a finite number > 0',
        'Camera',
      );
    }
    if (!Number.isFinite(options.viewportHeight) || options.viewportHeight <= 0) {
      throw new InvalidParameterError(
        'viewportHeight',
        options.viewportHeight,
        'a finite number > 0',
        'Camera',
      );
    }

    this.centerX = options.centerX;
    this.centerY = options.centerY;
    this.pixelsPerMeter = options.pixelsPerMeter;
    this.viewportWidth = options.viewportWidth;
    this.viewportHeight = options.viewportHeight;
  }

  /** Updates viewport pixel dimensions (e.g. on window resize). */
  public resize(width: number, height: number): void {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new InvalidParameterError(
        'viewport',
        [width, height],
        'positive finite dimensions',
        'Camera.resize',
      );
    }
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  /** Converts a world position in meters to screen coordinates in pixels. */
  public worldToScreen(worldX: number, worldY: number): Vec2 {
    return {
      x: (worldX - this.centerX) * this.pixelsPerMeter + this.viewportWidth * 0.5,
      y: (worldY - this.centerY) * this.pixelsPerMeter + this.viewportHeight * 0.5,
    };
  }

  /** Converts a screen pixel position to world coordinates in meters. */
  public screenToWorld(screenX: number, screenY: number): Vec2 {
    return {
      x: (screenX - this.viewportWidth * 0.5) / this.pixelsPerMeter + this.centerX,
      y: (screenY - this.viewportHeight * 0.5) / this.pixelsPerMeter + this.centerY,
    };
  }

  /** Pans the camera by a screen-space pixel drag delta. */
  public panByScreenDelta(deltaScreenX: number, deltaScreenY: number): void {
    assertFiniteNumber('deltaScreenX', deltaScreenX, 'Camera.panByScreenDelta');
    assertFiniteNumber('deltaScreenY', deltaScreenY, 'Camera.panByScreenDelta');
    this.centerX -= deltaScreenX / this.pixelsPerMeter;
    this.centerY -= deltaScreenY / this.pixelsPerMeter;
  }

  /** Zooms the camera by `factor` (> 0), optionally keeping the world point under `(screenX, screenY)` fixed. */
  public zoomBy(
    factor: number,
    minPixelsPerMeter = 2,
    maxPixelsPerMeter = 200,
    anchorScreenX?: number,
    anchorScreenY?: number,
  ): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new InvalidParameterError('factor', factor, 'a finite number > 0', 'Camera.zoomBy');
    }
    const before =
      anchorScreenX !== undefined && anchorScreenY !== undefined
        ? this.screenToWorld(anchorScreenX, anchorScreenY)
        : null;

    const next = Math.max(
      minPixelsPerMeter,
      Math.min(maxPixelsPerMeter, this.pixelsPerMeter * factor),
    );
    this.pixelsPerMeter = next;

    if (before !== null && anchorScreenX !== undefined && anchorScreenY !== undefined) {
      const after = this.screenToWorld(anchorScreenX, anchorScreenY);
      this.centerX += before.x - after.x;
      this.centerY += before.y - after.y;
    }
  }

  /** Returns the axis-aligned world bounds currently visible inside the viewport. */
  public getVisibleBounds(): WorldBounds {
    const halfW = this.viewportWidth / (2 * this.pixelsPerMeter);
    const halfH = this.viewportHeight / (2 * this.pixelsPerMeter);
    return {
      minX: this.centerX - halfW,
      minY: this.centerY - halfH,
      maxX: this.centerX + halfW,
      maxY: this.centerY + halfH,
    };
  }

  /** Returns `true` if a circle at `(worldX, worldY)` with `radiusMeters` overlaps the viewport. */
  public isCircleVisible(worldX: number, worldY: number, radiusMeters: number): boolean {
    const bounds = this.getVisibleBounds();
    return (
      worldX + radiusMeters >= bounds.minX &&
      worldX - radiusMeters <= bounds.maxX &&
      worldY + radiusMeters >= bounds.minY &&
      worldY - radiusMeters <= bounds.maxY
    );
  }
}
