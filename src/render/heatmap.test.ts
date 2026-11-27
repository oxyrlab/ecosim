import { describe, expect, it } from 'vitest';
import { FIELD_HEATMAP_PALETTES, mapFieldValueToCellStyle } from './heatmap';

describe('heatmap', () => {
  it('maps positive field intensities to color and alpha and skips negligible values', () => {
    expect(mapFieldValueToCellStyle('scent.plant', 0, 10)).toBeNull();
    expect(mapFieldValueToCellStyle('scent.plant', -1, 10)).toBeNull();
    expect(mapFieldValueToCellStyle('scent.plant', Number.NaN, 10)).toBeNull();
    expect(mapFieldValueToCellStyle('scent.plant', 0.01, 10)).toBeNull();

    const full = mapFieldValueToCellStyle('scent.predator', 5, 5);
    expect(full).toEqual({
      color: FIELD_HEATMAP_PALETTES['scent.predator']?.color,
      alpha: FIELD_HEATMAP_PALETTES['scent.predator']?.maxAlpha,
    });

    const half = mapFieldValueToCellStyle('soil.nutrients', 5, 10);
    expect(half?.alpha).toBeCloseTo(0.275, 4);

    // Unknown field uses fallback palette
    const custom = mapFieldValueToCellStyle('custom.field', 1, Number.NaN);
    expect(custom).toEqual({ color: 0x94a3b8, alpha: 0.5 });
  });
});
