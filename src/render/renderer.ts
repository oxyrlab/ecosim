import { Application, Graphics } from 'pixi.js';
import type { Vec2 } from '@core/index';
import { SNAPSHOT_STRIDE, type RenderSnapshot } from '@sim/snapshot';
import { Camera } from './camera';

/**
 * Options for initializing {@link EcoSimRenderer}.
 */
export interface RendererOptions {
  /** Host DOM element where the PixiJS canvas will be mounted. */
  readonly container: HTMLElement;
  /** World width in SI meters. */
  readonly worldWidthMeters: number;
  /** World height in SI meters. */
  readonly worldHeightMeters: number;
  /** Optional callback fired with SI world coordinates when the user clicks the canvas. */
  readonly onWorldClick?: (worldPosition: Vec2) => void;
}

/**
 * Main-thread PixiJS v8 renderer drawing world bounds and visible entities from Transferable
 * {@link RenderSnapshot}s with viewport culling via {@link Camera}.
 */
export class EcoSimRenderer {
  /** Interactive 2D top-down viewport camera. */
  public readonly camera: Camera;

  private readonly app: Application;
  private readonly graphics: Graphics;
  private readonly container: HTMLElement;
  private readonly onWorldClick: ((worldPosition: Vec2) => void) | undefined;
  private readonly cleanupListeners: Array<() => void> = [];
  private disposed = false;

  private constructor(
    app: Application,
    container: HTMLElement,
    worldWidthMeters: number,
    worldHeightMeters: number,
    onWorldClick?: (worldPosition: Vec2) => void,
  ) {
    this.app = app;
    this.container = container;
    this.onWorldClick = onWorldClick;
    this.graphics = new Graphics();
    this.app.stage.addChild(this.graphics);

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    const fitScale = Math.min(width / worldWidthMeters, height / worldHeightMeters) * 0.9;

    this.camera = new Camera({
      centerX: worldWidthMeters * 0.5,
      centerY: worldHeightMeters * 0.5,
      pixelsPerMeter: Math.max(2, fitScale),
      viewportWidth: width,
      viewportHeight: height,
    });

    this.bindInteractions();
  }

  /**
   * Asynchronously initializes PixiJS v8 and mounts the canvas into `options.container`.
   */
  public static async create(options: RendererOptions): Promise<EcoSimRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: options.container,
      antialias: true,
      background: 0x0f172a,
    });
    options.container.innerHTML = '';
    options.container.appendChild(app.canvas);
    return new EcoSimRenderer(
      app,
      options.container,
      options.worldWidthMeters,
      options.worldHeightMeters,
      options.onWorldClick,
    );
  }

  /**
   * Renders one {@link RenderSnapshot}, drawing only entities overlapping the camera viewport.
   *
   * @returns Number of entities drawn after viewport culling.
   */
  public render(snapshot: RenderSnapshot): number {
    if (this.disposed) return 0;

    const width = Math.max(1, this.app.renderer.width);
    const height = Math.max(1, this.app.renderer.height);
    if (width !== this.camera.viewportWidth || height !== this.camera.viewportHeight) {
      this.camera.resize(width, height);
    }

    const g = this.graphics;
    g.clear();

    // World boundary rectangle
    const topLeft = this.camera.worldToScreen(0, 0);
    const bottomRight = this.camera.worldToScreen(snapshot.worldWidth, snapshot.worldHeight);
    g.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    g.fill({ color: 0x1e293b });
    g.stroke({ color: 0x475569, width: 2 });

    const data = snapshot.entities;
    const ppm = this.camera.pixelsPerMeter;
    let drawn = 0;

    for (let i = 0; i < snapshot.entityCount; i += 1) {
      const offset = i * SNAPSHOT_STRIDE;
      const x = data[offset + 2] ?? 0;
      const y = data[offset + 3] ?? 0;
      const angle = data[offset + 4] ?? 0;
      const radius = data[offset + 5] ?? 0.2;
      const color = data[offset + 6] ?? 0x4ade80;

      if (!this.camera.isCircleVisible(x, y, radius)) continue;

      const pos = this.camera.worldToScreen(x, y);
      const pxRadius = Math.max(2, radius * ppm);
      g.circle(pos.x, pos.y, pxRadius);
      g.fill({ color });

      // Heading indicator line
      g.moveTo(pos.x, pos.y);
      g.lineTo(pos.x + Math.cos(angle) * pxRadius, pos.y + Math.sin(angle) * pxRadius);
      g.stroke({ color: 0x0f172a, width: 1.5 });

      drawn += 1;
    }

    return drawn;
  }

  /** Unmounts the canvas, removes DOM listeners, and destroys PixiJS resources. */
  public destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cleanup of this.cleanupListeners) {
      cleanup();
    }
    this.cleanupListeners.length = 0;
    this.app.destroy(true);
  }

  private bindInteractions(): void {
    const canvas = this.app.canvas;
    let dragging = false;
    let moved = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (event: PointerEvent): void => {
      dragging = true;
      moved = false;
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (Math.hypot(dx, dy) > 3) {
        moved = true;
      }
      lastX = event.clientX;
      lastY = event.clientY;
      this.camera.panByScreenDelta(dx, dy);
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (dragging && !moved && this.onWorldClick !== undefined) {
        const rect = canvas.getBoundingClientRect();
        const worldPos = this.camera.screenToWorld(
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        this.onWorldClick(worldPos);
      }
      dragging = false;
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      this.camera.zoomBy(factor, 2, 200, event.clientX - rect.left, event.clientY - rect.top);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    this.cleanupListeners.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      this.container.innerHTML = '';
    });
  }
}
