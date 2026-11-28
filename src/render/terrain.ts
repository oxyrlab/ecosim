import { createSeededRng } from '@core/index';

/**
 * Single subtle organic meadow or soil ground patch rendered beneath all entities.
 */
export interface TerrainPatch {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly color: number;
  readonly alpha: number;
}

/**
 * Palette constants for the clean dark-meadow terrain background (high contrast for animals,
 * foliage, berries, bones, and translucent field heatmaps).
 */
export const MEADOW_TERRAIN_COLORS = Object.freeze({
  baseFill: 0x1b2d22,
  borderStroke: 0x4b6a52,
  gridLine: 0xd1fae5,
  mossPatch: 0x243d2c,
  soilPatch: 0x2a2d21,
} as const);

/**
 * Deterministically generates subtle organic meadow and soil patches covering a world of
 * `(worldWidth, worldHeight)` meters. Pure & zero-DOM so it is unit-tested in Node.
 */
export function generateTerrainPatches(
  worldWidth: number,
  worldHeight: number,
  seed = 1337,
): readonly TerrainPatch[] {
  if (worldWidth <= 0 || worldHeight <= 0) return [];
  const rng = createSeededRng(seed);
  const area = worldWidth * worldHeight;
  const patchCount = Math.min(48, Math.max(8, Math.round(area / 65)));
  const patches: TerrainPatch[] = [];

  const maxRx = Math.max(0.25, Math.min(5.5, worldWidth * 0.18));
  const minRx = Math.min(1.6, maxRx * 0.45);
  const maxRy = Math.max(0.25, Math.min(4.8, worldHeight * 0.18));
  const minRy = Math.min(1.3, maxRy * 0.45);

  for (let i = 0; i < patchCount; i += 1) {
    const isSoil = i % 3 === 0;
    const rx = rng.nextRange(minRx, maxRx);
    const ry = rng.nextRange(minRy, maxRy);
    const x = worldWidth - rx > rx ? rng.nextRange(rx, worldWidth - rx) : worldWidth * 0.5;
    const y = worldHeight - ry > ry ? rng.nextRange(ry, worldHeight - ry) : worldHeight * 0.5;
    patches.push({
      x,
      y,
      rx,
      ry,
      color: isSoil ? MEADOW_TERRAIN_COLORS.soilPatch : MEADOW_TERRAIN_COLORS.mossPatch,
      alpha: isSoil ? 0.42 : 0.5,
    });
  }

  return patches;
}
