import { describe, expect, it } from 'vitest';
import { colorGeneSchema, colorGeneToHex } from './color';

describe('colorGene', () => {
  it('converts primary and grayscale HSL genes to 24-bit RGB hex', () => {
    expect(colorGeneToHex({ h: 0, s: 1, l: 0.5 })).toBe(0xff0000);
    expect(colorGeneToHex({ h: 120, s: 1, l: 0.5 })).toBe(0x00ff00);
    expect(colorGeneToHex({ h: 240, s: 1, l: 0.5 })).toBe(0x0000ff);
    expect(colorGeneToHex({ h: 60, s: 1, l: 0.5 })).toBe(0xffff00);
    expect(colorGeneToHex({ h: 180, s: 1, l: 0.5 })).toBe(0x00ffff);
    expect(colorGeneToHex({ h: 300, s: 1, l: 0.5 })).toBe(0xff00ff);
    expect(colorGeneToHex({ h: 0, s: 0, l: 0 })).toBe(0x000000);
    expect(colorGeneToHex({ h: 0, s: 0, l: 1 })).toBe(0xffffff);
  });

  it('validates ranges via colorGeneSchema', () => {
    expect(colorGeneSchema.parse({ h: 120, s: 0.5, l: 0.4 })).toEqual({ h: 120, s: 0.5, l: 0.4 });
    expect(() => colorGeneSchema.parse({ h: -1, s: 0.5, l: 0.5 })).toThrow();
    expect(() => colorGeneSchema.parse({ h: 100, s: 1.5, l: 0.5 })).toThrow();
  });
});
