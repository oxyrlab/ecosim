import { describe, expect, it } from 'vitest';
import { getPlantSpriteSpecForKind } from './plant-shapes';

describe('plant-shapes', () => {
  it('builds cached 6-stage top-down specs for grass and berry-bush and returns null for non-plants', () => {
    expect(getPlantSpriteSpecForKind(1)).toBeNull();
    expect(getPlantSpriteSpecForKind(10)).toBeNull();

    // Grass stages 20..25 + legacy kind 2
    for (let kind = 20; kind <= 25; kind += 1) {
      const spec = getPlantSpriteSpecForKind(kind);
      expect(spec).not.toBeNull();
      expect(spec?.primitives.length).toBeGreaterThanOrEqual(3);
      expect(getPlantSpriteSpecForKind(kind)).toBe(spec);
    }
    expect(getPlantSpriteSpecForKind(2)?.key).toBe('grass-stage-2');

    // Berry bush stages 30..35 + legacy kind 4
    for (let kind = 30; kind <= 35; kind += 1) {
      const spec = getPlantSpriteSpecForKind(kind);
      expect(spec).not.toBeNull();
      expect(spec?.primitives.length).toBeGreaterThanOrEqual(3);
      expect(getPlantSpriteSpecForKind(kind)).toBe(spec);
    }
    expect(getPlantSpriteSpecForKind(4)?.key).toBe('berry-bush-stage-2');

    // Flowering bush has more primitives than mature bush due to blossoms; fruiting due to berries
    const matureBush = getPlantSpriteSpecForKind(32);
    const flowerBush = getPlantSpriteSpecForKind(33);
    const fruitBush = getPlantSpriteSpecForKind(34);
    expect(flowerBush?.primitives.length).toBeGreaterThan(matureBush?.primitives.length ?? 0);
    expect(fruitBush?.primitives.length).toBeGreaterThan(matureBush?.primitives.length ?? 0);
  });
});
