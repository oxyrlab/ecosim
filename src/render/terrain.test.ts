import { describe, expect, it } from 'vitest';
import { generateTerrainPatches, MEADOW_TERRAIN_COLORS } from './terrain';

describe('terrain', () => {
  it('generates deterministic organic meadow and soil patches bounded inside the arena', () => {
    expect(generateTerrainPatches(0, 40)).toEqual([]);
    expect(generateTerrainPatches(40, -1)).toEqual([]);

    const a = generateTerrainPatches(40, 40, 1337);
    const b = generateTerrainPatches(40, 40, 1337);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(8);

    const hasMoss = a.some((p) => p.color === MEADOW_TERRAIN_COLORS.mossPatch);
    const hasSoil = a.some((p) => p.color === MEADOW_TERRAIN_COLORS.soilPatch);
    expect(hasMoss).toBe(true);
    expect(hasSoil).toBe(true);
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(40);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(40);
    }

    // Compact arenas (e.g. 10x10 m reproduction glade or tiny 2x2 m arenas) never throw
    const small = generateTerrainPatches(10, 10, 1337);
    expect(small.length).toBeGreaterThanOrEqual(8);
    for (const p of small) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(10);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(10);
    }
    expect(generateTerrainPatches(2, 2, 1337).length).toBeGreaterThanOrEqual(8);
  });
});
