import { Application, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { PathCommand } from '@appearance/shapes';
import type { ResolvedBodyLayout, ResolvedPart } from '@appearance/types';
import type { Vec2 } from '@core/index';
import type { FieldHeatmapSnapshot } from '@sim/simulation';
import { SNAPSHOT_STRIDE, type RenderSnapshot } from '@sim/snapshot';
import { Camera } from './camera';
import { mapFieldValueToCellStyle } from './heatmap';
import {
  buildProceduralDrawParts,
  getProceduralLayoutForKind,
  RENDER_KIND,
} from './species-shapes';
import { AppearanceTextureCache } from './texture-cache';

const TEXTURE_PIXELS_PER_METER = 64;

/**
 * Pointer interaction mode for {@link EcoSimRenderer}.
 */
export type RendererInteractionMode = 'pan' | 'brush';

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
  /** Optional callback fired while dragging in `'brush'` mode. */
  readonly onWorldDrag?: (worldPosition: Vec2) => void;
}

function replayPathCommands(
  g: Graphics,
  commands: readonly PathCommand[],
  ox: number,
  oy: number,
  angle: number,
  ppm: number,
): void {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const tx = (x: number, y: number): number => (ox + x * cosA - y * sinA) * ppm;
  const ty = (x: number, y: number): number => (oy + x * sinA + y * cosA) * ppm;

  for (let i = 0; i < commands.length; i += 1) {
    const cmd = commands[i] as PathCommand;
    switch (cmd.kind) {
      case 'moveTo':
        g.moveTo(tx(cmd.x, cmd.y), ty(cmd.x, cmd.y));
        break;
      case 'lineTo':
        g.lineTo(tx(cmd.x, cmd.y), ty(cmd.x, cmd.y));
        break;
      case 'arc':
        g.arc(
          tx(cmd.cx, cmd.cy),
          ty(cmd.cx, cmd.cy),
          cmd.radius * ppm,
          cmd.startAngle + angle,
          cmd.endAngle + angle,
          false,
        );
        break;
      case 'closePath':
        g.closePath();
        break;
    }
  }
}

/**
 * Main-thread PixiJS v8 renderer drawing world bounds, optional field heatmaps, cached procedural
 * species textures (`AppearanceTextureCache` + pooled `Sprite`s), plants/fruits, and selected-entity
 * highlights with viewport culling via {@link Camera}.
 */
export class EcoSimRenderer {
  /** Interactive 2D top-down viewport camera. */
  public readonly camera: Camera;

  private readonly app: Application;
  private readonly backgroundGraphics: Graphics;
  private readonly heatmapGraphics: Graphics;
  private readonly entityGraphics: Graphics;
  private readonly spriteLayer: Container;
  private readonly overlayGraphics: Graphics;
  private readonly spritePool: Sprite[] = [];
  private readonly textureCache: AppearanceTextureCache<Texture>;
  private readonly container: HTMLElement;
  private readonly onWorldClick: ((worldPosition: Vec2) => void) | undefined;
  private readonly onWorldDrag: ((worldPosition: Vec2) => void) | undefined;
  private readonly cleanupListeners: Array<() => void> = [];
  private heatmap: FieldHeatmapSnapshot | null = null;
  private selectedEntityId: number | null = null;
  private interactionMode: RendererInteractionMode = 'pan';
  private disposed = false;

  private constructor(
    app: Application,
    container: HTMLElement,
    worldWidthMeters: number,
    worldHeightMeters: number,
    onWorldClick?: (worldPosition: Vec2) => void,
    onWorldDrag?: (worldPosition: Vec2) => void,
  ) {
    this.app = app;
    this.container = container;
    this.onWorldClick = onWorldClick;
    this.onWorldDrag = onWorldDrag;
    this.backgroundGraphics = new Graphics();
    this.heatmapGraphics = new Graphics();
    this.entityGraphics = new Graphics();
    this.spriteLayer = new Container();
    this.overlayGraphics = new Graphics();

    this.app.stage.addChild(this.backgroundGraphics);
    this.app.stage.addChild(this.heatmapGraphics);
    this.app.stage.addChild(this.entityGraphics);
    this.app.stage.addChild(this.spriteLayer);
    this.app.stage.addChild(this.overlayGraphics);

    this.textureCache = new AppearanceTextureCache<Texture>(
      (staticParts, layout) => this.bakeLayoutTexture(staticParts, layout),
      (tex) => tex.destroy(true),
    );

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    const fitScale = Math.min(width / worldWidthMeters, height / worldHeightMeters) * 0.86;

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
      options.onWorldDrag,
    );
  }

  /** Sets or clears the active environmental/scent field heatmap overlay. */
  public setHeatmap(heatmap: FieldHeatmapSnapshot | null): void {
    this.heatmap = heatmap;
  }

  /** Sets or clears the highlighted entity ID drawn with a selection ring. */
  public setSelectedEntityId(entityId: number | null): void {
    this.selectedEntityId = entityId;
  }

  /** Switches left-button drag between camera panning and Sandbox field brushing. */
  public setInteractionMode(mode: RendererInteractionMode): void {
    this.interactionMode = mode;
    this.app.canvas.style.cursor = mode === 'brush' ? 'crosshair' : 'grab';
  }

  /** Centers and scales the camera to fit a world of the given SI dimensions. */
  public fitWorld(worldWidthMeters: number, worldHeightMeters: number): void {
    const width = Math.max(1, this.app.renderer.width);
    const height = Math.max(1, this.app.renderer.height);
    const fitScale = Math.min(width / worldWidthMeters, height / worldHeightMeters) * 0.86;
    this.camera.centerX = worldWidthMeters * 0.5;
    this.camera.centerY = worldHeightMeters * 0.5;
    this.camera.pixelsPerMeter = Math.max(2, fitScale);
  }

  /**
   * Renders one {@link RenderSnapshot} plus any active heatmap overlay, cached procedural creature
   * sprites, and selection highlight.
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

    // 1. World background rectangle
    const bg = this.backgroundGraphics;
    bg.clear();
    const topLeft = this.camera.worldToScreen(0, 0);
    const bottomRight = this.camera.worldToScreen(snapshot.worldWidth, snapshot.worldHeight);
    bg.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    bg.fill({ color: 0x1e293b });
    bg.stroke({ color: 0x475569, width: 2 });

    // 2. Optional field heatmap layer
    this.renderHeatmap();

    // 3. Entities (cached procedural sprites for animals + vector shapes for flora/objects)
    const g = this.entityGraphics;
    const og = this.overlayGraphics;
    g.clear();
    og.clear();

    const data = snapshot.entities;
    const ppm = this.camera.pixelsPerMeter;
    const spriteScaleFactor = ppm / TEXTURE_PIXELS_PER_METER;
    let drawn = 0;
    let spritesUsed = 0;

    for (let i = 0; i < snapshot.entityCount; i += 1) {
      const offset = i * SNAPSHOT_STRIDE;
      const id = data[offset] ?? 0;
      const kind = Math.round(data[offset + 1] ?? 1);
      const x = data[offset + 2] ?? 0;
      const y = data[offset + 3] ?? 0;
      const angle = data[offset + 4] ?? 0;
      const radius = data[offset + 5] ?? 0.2;
      const color = data[offset + 6] ?? 0x4ade80;

      if (!this.camera.isCircleVisible(x, y, radius)) continue;

      const pos = this.camera.worldToScreen(x, y);
      const pxRadius = Math.max(2.5, radius * ppm);

      const proceduralLayout = getProceduralLayoutForKind(kind);
      if (proceduralLayout !== null) {
        const baked = this.textureCache.getOrBake(proceduralLayout);
        const sprite = this.acquireSprite(spritesUsed);
        spritesUsed += 1;
        sprite.texture = baked.texture;
        sprite.visible = true;
        sprite.position.set(pos.x, pos.y);
        sprite.rotation = angle;
        sprite.scale.set(spriteScaleFactor);
      } else if (kind === RENDER_KIND.BUSH) {
        // Multi-lobe berry bush canopy
        g.circle(pos.x, pos.y, pxRadius);
        g.fill({ color, alpha: 0.92 });
        g.circle(pos.x - pxRadius * 0.35, pos.y - pxRadius * 0.25, pxRadius * 0.55);
        g.circle(pos.x + pxRadius * 0.35, pos.y + pxRadius * 0.2, pxRadius * 0.52);
        g.fill({ color: 0x16a34a, alpha: 0.75 });
      } else if (kind === RENDER_KIND.PLANT) {
        // Leafy grass rosette
        g.circle(pos.x, pos.y, pxRadius);
        g.fill({ color, alpha: 0.85 });
        g.circle(pos.x, pos.y, pxRadius * 0.45);
        g.fill({ color: 0x86efac, alpha: 0.65 });
      } else {
        g.circle(pos.x, pos.y, pxRadius);
        g.fill({ color });
        if (kind !== RENDER_KIND.FRUIT) {
          g.moveTo(pos.x, pos.y);
          g.lineTo(pos.x + Math.cos(angle) * pxRadius, pos.y + Math.sin(angle) * pxRadius);
          g.stroke({ color: 0x0f172a, width: 1.5 });
        }
      }

      if (this.selectedEntityId !== null && Math.round(id) === this.selectedEntityId) {
        og.circle(pos.x, pos.y, pxRadius + 5);
        og.stroke({ color: 0xfacc15, width: 2.5 });
      }

      drawn += 1;
    }

    // Hide unused pooled sprites without destroying them
    for (let s = spritesUsed; s < this.spritePool.length; s += 1) {
      const sprite = this.spritePool[s];
      if (sprite !== undefined) sprite.visible = false;
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
    this.textureCache.clear();
    this.spritePool.length = 0;
    this.app.destroy(true);
  }

  private acquireSprite(index: number): Sprite {
    const existing = this.spritePool[index];
    if (existing !== undefined) return existing;
    const created = new Sprite();
    created.anchor.set(0.5);
    this.spriteLayer.addChild(created);
    this.spritePool.push(created);
    return created;
  }

  private bakeLayoutTexture(
    _staticParts: readonly ResolvedPart[],
    layout: ResolvedBodyLayout,
  ): Texture {
    const g = new Graphics();
    const parts = buildProceduralDrawParts(layout.parts);
    for (const part of parts) {
      replayPathCommands(g, part.commands, part.x, part.y, part.angle, TEXTURE_PIXELS_PER_METER);
      g.fill({ color: part.fillColor });
      if (part.strokeColor !== null && part.strokeWidth > 0) {
        g.stroke({
          color: part.strokeColor,
          width: Math.max(1, part.strokeWidth * TEXTURE_PIXELS_PER_METER),
        });
      }
    }
    const texture = this.app.renderer.generateTexture({ target: g, antialias: true });
    g.destroy();
    return texture;
  }

  private renderHeatmap(): void {
    const hg = this.heatmapGraphics;
    hg.clear();
    const map = this.heatmap;
    if (map === null) return;

    const bounds = this.camera.getVisibleBounds();
    const cell = map.cellSizeMeters;
    const startCol = Math.max(0, Math.floor(bounds.minX / cell));
    const endCol = Math.min(map.cols - 1, Math.ceil(bounds.maxX / cell));
    const startRow = Math.max(0, Math.floor(bounds.minY / cell));
    const endRow = Math.min(map.rows - 1, Math.ceil(bounds.maxY / cell));
    const cellPx = cell * this.camera.pixelsPerMeter + 0.5;

    for (let row = startRow; row <= endRow; row += 1) {
      const rowOffset = row * map.cols;
      for (let col = startCol; col <= endCol; col += 1) {
        const value = map.data[rowOffset + col] ?? 0;
        const style = mapFieldValueToCellStyle(map.fieldName, value, map.maxValue);
        if (style === null) continue;
        const screen = this.camera.worldToScreen(col * cell, row * cell);
        hg.rect(screen.x, screen.y, cellPx, cellPx);
        hg.fill({ color: style.color, alpha: style.alpha });
      }
    }
  }

  private bindInteractions(): void {
    const canvas = this.app.canvas;
    let dragging = false;
    let moved = false;
    let panDrag = false;
    let lastX = 0;
    let lastY = 0;

    const toWorldPos = (event: PointerEvent): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      return this.camera.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
    };

    const onPointerDown = (event: PointerEvent): void => {
      dragging = true;
      moved = false;
      panDrag = this.interactionMode === 'pan' || event.button !== 0 || event.shiftKey;
      lastX = event.clientX;
      lastY = event.clientY;
      if (!panDrag && this.onWorldDrag !== undefined) {
        this.onWorldDrag(toWorldPos(event));
      }
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
      if (panDrag) {
        this.camera.panByScreenDelta(dx, dy);
      } else if (this.onWorldDrag !== undefined) {
        this.onWorldDrag(toWorldPos(event));
      }
    };

    const onPointerUp = (event: PointerEvent): void => {
      if (dragging && !moved && panDrag && this.onWorldClick !== undefined) {
        this.onWorldClick(toWorldPos(event));
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
