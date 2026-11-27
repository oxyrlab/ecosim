import { describe, expect, it } from 'vitest';
import { extractAppearanceFeatures } from './features';
import { resolveLayout } from './layout';

describe('appearance feature extraction', () => {
  it('extracts normalized [0, 1] visual features distinguishing different body silhouettes and colors', () => {
    const smallGrey = resolveLayout([
      {
        id: 'torso',
        shape: { type: 'circle', r: 0.2 },
        style: { fill: { h: 36, s: 0.2, l: 0.8 } },
      },
    ]);
    const largeRed = resolveLayout([
      {
        id: 'torso',
        shape: { type: 'triangle', w: 0.9, h: 0.7 },
        style: { fill: { h: 18, s: 0.8, l: 0.4 } },
      },
      {
        id: 'head',
        parent: 'torso',
        at: 'front',
        pivot: 'back',
        shape: { type: 'circle', r: 0.2 },
      },
    ]);

    const f1 = extractAppearanceFeatures(smallGrey);
    const f2 = extractAppearanceFeatures(largeRed);

    for (const f of [f1, f2]) {
      expect(f.size).toBeGreaterThanOrEqual(0);
      expect(f.size).toBeLessThanOrEqual(1);
      expect(f.hue).toBeGreaterThanOrEqual(0);
      expect(f.hue).toBeLessThanOrEqual(1);
      expect(f.lightness).toBeGreaterThanOrEqual(0);
      expect(f.lightness).toBeLessThanOrEqual(1);
      expect(f.shape).toBeGreaterThanOrEqual(0);
      expect(f.shape).toBeLessThanOrEqual(1);
      expect(f.parts).toBeGreaterThanOrEqual(0);
      expect(f.parts).toBeLessThanOrEqual(1);
    }

    expect(f2.size).toBeGreaterThan(f1.size);
    expect(f2.parts).toBeGreaterThan(f1.parts);
    expect(f2.shape).not.toBe(f1.shape);
    expect(f2.lightness).toBeLessThan(f1.lightness);
  });
});
