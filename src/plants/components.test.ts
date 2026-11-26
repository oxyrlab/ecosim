import { describe, expect, it } from 'vitest';
import { FruitComponent, parsePlantSpeciesSpec, PlantComponent } from './components';

describe('plant components and species schema', () => {
  it('parses PlantSpeciesSpec with sensible defaults and freezes the result', () => {
    const spec = parsePlantSpeciesSpec({ speciesId: 'berry-bush' });
    expect(spec.speciesId).toBe('berry-bush');
    expect(spec.seedRadius).toBeGreaterThan(0);
    expect(spec.adultRadius).toBeGreaterThan(spec.seedRadius);
    expect(spec.scentField).toBe('scent.plant');
    expect(Object.isFrozen(spec)).toBe(true);
    expect(PlantComponent.id).toBe('plant');
    expect(FruitComponent.id).toBe('fruit');
  });

  it('rejects invalid PlantSpeciesSpec inputs', () => {
    expect(() => parsePlantSpeciesSpec({ speciesId: '' })).toThrow();
    expect(() => parsePlantSpeciesSpec({ speciesId: 'bad', nutrientFraction: 1.5 })).toThrow();
  });
});
