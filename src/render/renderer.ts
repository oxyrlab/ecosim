import { Application, Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import { REPRODUCTIVE_ORGAN_COLORS } from '@body/organs';
import { clamp, type Vec2 } from '@core/index';
import type { FieldHeatmapSnapshot } from '@sim/simulation';
import { SNAPSHOT_STRIDE, type RenderSnapshot } from '@sim/snapshot';
import { Camera } from './camera';
import { mapFieldValueToCellStyle } from './heatmap';
import { getObjectSpriteSpecForKind } from './object-shapes';
import {
  getPlantSpriteSpecForKind,
  type BakedSpriteSpec,
  type VectorPrimitive,
} from './plant-shapes';
import { getAnimalSpriteSpecForKind, RENDER_KIND } from './species-shapes';
import { generateTerrainPatches, MEADOW_TERRAIN_COLORS, type TerrainPatch } from './terrain';

const ANIMAL_PX_PER_METER = 140;
const PLANT_PX_PER_UNIT = 96;
const OBJECT_PX_PER_UNIT = 96;
const ANIMAL_VISUAL_BOOST = 1.45;
const PLANT_VISUAL_BOOST = 1.45;
const OBJECT_VISUAL_BOOST = 1.35;

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

function drawVectorPrimitive(g: Graphics, prim: VectorPrimitive, scale: number): void {
  const alpha = prim.alpha ?? 1;
  switch (prim.shape) {
    case 'circle':
      g.circle(prim.x * scale, prim.y * scale, prim.r * scale);
      break;

    case 'ellipse': {
      const rot = prim.angle ?? 0;
      if (Math.abs(rot) < 1e-5) {
        g.ellipse(prim.x * scale, prim.y * scale, prim.rx * scale, prim.ry * scale);
      } else {
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const segments = 24;
        const pts: number[] = [];
        for (let i = 0; i < segments; i += 1) {
          const t = (i / segments) * Math.PI * 2;
          const lx = Math.cos(t) * prim.rx;
          const ly = Math.sin(t) * prim.ry;
          pts.push((prim.x + lx * cos - ly * sin) * scale, (prim.y + lx * sin + ly * cos) * scale);
        }
        g.poly(pts, true);
      }
      break;
    }

    case 'polygon': {
      const pts: number[] = [];
      for (let i = 0; i < prim.points.length; i += 1) {
        const pt = prim.points[i] as readonly [number, number];
        pts.push(pt[0] * scale, pt[1] * scale);
      }
      g.poly(pts, true);
      break;
    }
  }

  g.fill({ color: prim.fill, alpha });
  if (prim.stroke !== undefined && (prim.strokeWidth ?? 0) > 0) {
    g.stroke({
      color: prim.stroke,
      width: Math.max(1.2, (prim.strokeWidth ?? 0.02) * scale),
      alpha,
    });
  }
}

/**
 * Main-thread PixiJS v8 renderer drawing organic meadow terrain, optional field heatmaps, cached
 * high-DPI procedural sprites for animals (`rabbit`, `fox`), 6-stage plants (`grass`, `berry-bush`),
 * biological/world objects (`fruit`, `corpse`, `rock`), and selected-entity highlights with
 * viewport culling via {@link Camera}.
 */
export class EcoSimRenderer {
  /** Interactive 2D top-down viewport camera. */
  public readonly camera: Camera;

  private readonly app: Application;
  private readonly backgroundGraphics: Graphics;
  private readonly heatmapGraphics: Graphics;
  private readonly plantSpriteLayer: Container;
  private readonly objectSpriteLayer: Container;
  private readonly fallbackGraphics: Graphics;
  private readonly animalSpriteLayer: Container;
  private readonly overlayGraphics: Graphics;
  private readonly plantSpritePool: Sprite[] = [];
  private readonly objectSpritePool: Sprite[] = [];
  private readonly animalSpritePool: Sprite[] = [];
  private readonly bakedTextures = new Map<string, Texture>();
  private readonly container: HTMLElement;
  private readonly onWorldClick: ((worldPosition: Vec2) => void) | undefined;
  private readonly onWorldDrag: ((worldPosition: Vec2) => void) | undefined;
  private readonly cleanupListeners: Array<() => void> = [];
  private terrainCacheKey = '';
  private terrainPatches: readonly TerrainPatch[] = [];
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
    this.plantSpriteLayer = new Container();
    this.objectSpriteLayer = new Container();
    this.fallbackGraphics = new Graphics();
    this.animalSpriteLayer = new Container();
    this.overlayGraphics = new Graphics();

    this.app.stage.addChild(this.backgroundGraphics);
    this.app.stage.addChild(this.heatmapGraphics);
    this.app.stage.addChild(this.plantSpriteLayer);
    this.app.stage.addChild(this.objectSpriteLayer);
    this.app.stage.addChild(this.fallbackGraphics);
    this.app.stage.addChild(this.animalSpriteLayer);
    this.app.stage.addChild(this.overlayGraphics);

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
   * Renders one {@link RenderSnapshot} plus organic meadow ground, optional heatmap overlay,
   * cached procedural animal/plant/object sprites, and selection highlight.
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

    // 1. Organic meadow terrain + subtle topographic grid
    this.renderTerrain(snapshot.worldWidth, snapshot.worldHeight);

    // 2. Optional field heatmap layer
    this.renderHeatmap();

    // 3. Entities (plants -> world objects -> animals)
    const fg = this.fallbackGraphics;
    const og = this.overlayGraphics;
    fg.clear();
    og.clear();

    const data = snapshot.entities;
    const ppm = this.camera.pixelsPerMeter;
    const time = snapshot.timeSeconds;
    let drawn = 0;
    let plantSpritesUsed = 0;
    let objectSpritesUsed = 0;
    let animalSpritesUsed = 0;

    for (let i = 0; i < snapshot.entityCount; i += 1) {
      const offset = i * SNAPSHOT_STRIDE;
      const id = Math.round(data[offset] ?? 0);
      const kind = Math.round(data[offset + 1] ?? 1);
      const x = data[offset + 2] ?? 0;
      const y = data[offset + 3] ?? 0;
      const angle = data[offset + 4] ?? 0;
      const radius = data[offset + 5] ?? 0.2;
      const color = data[offset + 6] ?? 0x4ade80;

      if (!this.camera.isCircleVisible(x, y, Math.max(radius * 1.6, 0.8))) continue;

      const pos = this.camera.worldToScreen(x, y);
      const pxRadius = Math.max(3, radius * ppm);

      const animalSpec = getAnimalSpriteSpecForKind(kind);
      if (animalSpec !== null) {
        const tex = this.getOrBakeTexture(animalSpec, ANIMAL_PX_PER_METER);
        const sprite = this.acquirePooledSprite(
          this.animalSpritePool,
          this.animalSpriteLayer,
          animalSpritesUsed,
        );
        animalSpritesUsed += 1;
        const growthScale = clamp(radius / animalSpec.referenceRadius, 0.38, 1.55);
        const s = (growthScale * ppm * ANIMAL_VISUAL_BOOST) / ANIMAL_PX_PER_METER;
        sprite.texture = tex;
        sprite.visible = true;
        sprite.position.set(pos.x, pos.y);
        sprite.rotation = angle;
        sprite.scale.set(s);
        // Subtle color spot representing the animal's reproductive organ (blue = male, pink = female)
        if (
          color === REPRODUCTIVE_ORGAN_COLORS.male ||
          color === REPRODUCTIVE_ORGAN_COLORS.female
        ) {
          const spotOffsetPx = pxRadius * 0.34;
          const spotX = pos.x - Math.cos(angle) * spotOffsetPx;
          const spotY = pos.y - Math.sin(angle) * spotOffsetPx;
          const spotR = clamp(ppm * 0.065 * growthScale, 1.8, 5.5);
          og.circle(spotX, spotY, spotR);
          og.fill({ color, alpha: 0.92 });
          og.stroke({ color: 0x0f172a, width: 1, alpha: 0.7 });
        }
      } else {
        const plantSpec = getPlantSpriteSpecForKind(kind);
        if (plantSpec !== null) {
          const tex = this.getOrBakeTexture(plantSpec, PLANT_PX_PER_UNIT);
          const sprite = this.acquirePooledSprite(
            this.plantSpritePool,
            this.plantSpriteLayer,
            plantSpritesUsed,
          );
          plantSpritesUsed += 1;
          const baseRot = ((id * 2654435761) % 628) / 100;
          const sway = Math.sin(time * 1.4 + id * 0.7) * 0.025;
          const visualRadius = Math.max(radius, 0.11);
          const s = (visualRadius * ppm * PLANT_VISUAL_BOOST * (1 + sway)) / PLANT_PX_PER_UNIT;
          sprite.texture = tex;
          sprite.visible = true;
          sprite.position.set(pos.x, pos.y);
          sprite.rotation = baseRot + sway * 0.5;
          sprite.scale.set(s);
        } else {
          const objectSpec = getObjectSpriteSpecForKind(kind);
          if (objectSpec !== null) {
            const tex = this.getOrBakeTexture(objectSpec, OBJECT_PX_PER_UNIT);
            const sprite = this.acquirePooledSprite(
              this.objectSpritePool,
              this.objectSpriteLayer,
              objectSpritesUsed,
            );
            objectSpritesUsed += 1;
            const visualRadius = Math.max(radius, kind === RENDER_KIND.FRUIT ? 0.14 : 0.16);
            const s = (visualRadius * ppm * OBJECT_VISUAL_BOOST) / OBJECT_PX_PER_UNIT;
            const objectRot = kind === RENDER_KIND.FRUIT ? (((id * 37) % 60) - 30) * 0.01 : angle;
            sprite.texture = tex;
            sprite.visible = true;
            sprite.position.set(pos.x, pos.y);
            sprite.rotation = objectRot;
            sprite.scale.set(s);
          } else {
            fg.circle(pos.x, pos.y, pxRadius);
            fg.fill({ color });
            fg.moveTo(pos.x, pos.y);
            fg.lineTo(pos.x + Math.cos(angle) * pxRadius, pos.y + Math.sin(angle) * pxRadius);
            fg.stroke({ color: 0x0f172a, width: 1.5 });
          }
        }
      }

      if (this.selectedEntityId !== null && id === this.selectedEntityId) {
        og.circle(pos.x, pos.y, Math.max(pxRadius * 1.45, 12));
        og.stroke({ color: 0xfacc15, width: 2.5 });
      }

      drawn += 1;
    }

    this.hideUnusedSprites(this.plantSpritePool, plantSpritesUsed);
    this.hideUnusedSprites(this.objectSpritePool, objectSpritesUsed);
    this.hideUnusedSprites(this.animalSpritePool, animalSpritesUsed);

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
    for (const tex of this.bakedTextures.values()) {
      tex.destroy(true);
    }
    this.bakedTextures.clear();
    this.plantSpritePool.length = 0;
    this.objectSpritePool.length = 0;
    this.animalSpritePool.length = 0;
    this.app.destroy(true);
  }

  private renderTerrain(worldWidth: number, worldHeight: number): void {
    const key = `${worldWidth}x${worldHeight}`;
    if (key !== this.terrainCacheKey) {
      this.terrainCacheKey = key;
      this.terrainPatches = generateTerrainPatches(worldWidth, worldHeight);
    }

    const bg = this.backgroundGraphics;
    bg.clear();
    const topLeft = this.camera.worldToScreen(0, 0);
    const bottomRight = this.camera.worldToScreen(worldWidth, worldHeight);
    const arenaW = bottomRight.x - topLeft.x;
    const arenaH = bottomRight.y - topLeft.y;
    const ppm = this.camera.pixelsPerMeter;

    // Base dark-meadow turf
    bg.rect(topLeft.x, topLeft.y, arenaW, arenaH);
    bg.fill({ color: MEADOW_TERRAIN_COLORS.baseFill });

    // Subtle organic meadow & soil patches
    for (let i = 0; i < this.terrainPatches.length; i += 1) {
      const p = this.terrainPatches[i] as TerrainPatch;
      if (!this.camera.isCircleVisible(p.x, p.y, Math.max(p.rx, p.ry))) continue;
      const center = this.camera.worldToScreen(p.x, p.y);
      bg.ellipse(center.x, center.y, p.rx * ppm, p.ry * ppm);
      bg.fill({ color: p.color, alpha: p.alpha });
    }

    // Subtle 5m reference grid
    const gridStep = 5;
    for (let gx = gridStep; gx < worldWidth; gx += gridStep) {
      const sx = topLeft.x + gx * ppm;
      bg.moveTo(sx, topLeft.y);
      bg.lineTo(sx, bottomRight.y);
    }
    for (let gy = gridStep; gy < worldHeight; gy += gridStep) {
      const sy = topLeft.y + gy * ppm;
      bg.moveTo(topLeft.x, sy);
      bg.lineTo(bottomRight.x, sy);
    }
    bg.stroke({ color: MEADOW_TERRAIN_COLORS.gridLine, width: 1, alpha: 0.04 });

    // Clean earthy arena frame
    bg.rect(topLeft.x, topLeft.y, arenaW, arenaH);
    bg.stroke({ color: MEADOW_TERRAIN_COLORS.borderStroke, width: 2.5 });
  }

  private acquirePooledSprite(pool: Sprite[], layer: Container, index: number): Sprite {
    const existing = pool[index];
    if (existing !== undefined) return existing;
    const created = new Sprite();
    created.anchor.set(0.5);
    layer.addChild(created);
    pool.push(created);
    return created;
  }

  private hideUnusedSprites(pool: Sprite[], usedCount: number): void {
    for (let i = usedCount; i < pool.length; i += 1) {
      const sprite = pool[i];
      if (sprite !== undefined) sprite.visible = false;
    }
  }

  private getOrBakeTexture(spec: BakedSpriteSpec, pxPerUnit: number): Texture {
    const existing = this.bakedTextures.get(spec.key);
    if (existing !== undefined) return existing;

    const g = new Graphics();
    for (let i = 0; i < spec.primitives.length; i += 1) {
      drawVectorPrimitive(g, spec.primitives[i] as VectorPrimitive, pxPerUnit);
    }

    const halfPx = Math.ceil(spec.halfExtent * pxPerUnit);
    const frame = new Rectangle(-halfPx, -halfPx, halfPx * 2, halfPx * 2);
    const texture = this.app.renderer.generateTexture({
      target: g,
      frame,
      antialias: true,
    });
    g.destroy();
    this.bakedTextures.set(spec.key, texture);
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
