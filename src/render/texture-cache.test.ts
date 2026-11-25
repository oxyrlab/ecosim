import { describe, expect, it, vi } from 'vitest';
import { resolveLayout } from '@appearance/index';
import { AppearanceTextureCache, splitAppearanceLayers } from './texture-cache';

describe('AppearanceTextureCache & splitAppearanceLayers', () => {
  const parts = [
    { id: 'torso', z: 1, shape: { type: 'ellipse', w: 0.6, h: 0.3 } },
    {
      id: 'head',
      parent: 'torso',
      z: 2,
      at: 'front' as const,
      pivot: 'back' as const,
      shape: { type: 'circle', r: 0.14 },
    },
    {
      id: 'tail',
      parent: 'torso',
      z: 0,
      at: 'back' as const,
      pivot: 'front' as const,
      joint: { type: 'revolute' as const },
      shape: { type: 'capsule', length: 0.2, radius: 0.03 },
      anim: [{ kind: 'wag' as const, channel: 'fear:level', amplitude: 0.3 }],
    },
  ];

  it('splits static vs dynamic layers sorted by z and bakes once per appearanceSignature', () => {
    const layoutA = resolveLayout(parts, 1);
    const layoutB = resolveLayout(parts, 1);
    const layoutBig = resolveLayout(parts, 1.5);

    const layers = splitAppearanceLayers(layoutA);
    expect(layers.staticParts.map((p) => p.id)).toEqual(['torso', 'head']);
    expect(layers.dynamicParts.map((p) => p.id)).toEqual(['tail']);

    const bake = vi.fn((staticParts) => ({
      bakedIds: staticParts.map((p: { id: string }) => p.id),
    }));
    const dispose = vi.fn();
    const cache = new AppearanceTextureCache(bake, dispose);

    const entry1 = cache.getOrBake(layoutA);
    const entry2 = cache.getOrBake(layoutB);
    expect(entry1).toBe(entry2);
    expect(bake).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(1);
    expect(cache.has(layoutA.appearanceSignature)).toBe(true);

    cache.getOrBake(layoutBig);
    expect(bake).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(2);

    cache.clear();
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });
});
