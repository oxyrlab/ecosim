import { describe, expect, it } from 'vitest';
import { getObjectSpriteSpecForKind } from './object-shapes';
import { RENDER_KIND } from './species-shapes';

describe('object-shapes', () => {
  it('builds cached top-down specs for fruit, corpse, and rock obstacles and returns null for animals/plants', () => {
    expect(getObjectSpriteSpecForKind(RENDER_KIND.RABBIT)).toBeNull();
    expect(getObjectSpriteSpecForKind(RENDER_KIND.GRASS_MATURE)).toBeNull();

    const fruit = getObjectSpriteSpecForKind(RENDER_KIND.FRUIT);
    const corpse = getObjectSpriteSpecForKind(RENDER_KIND.CORPSE);
    const rock = getObjectSpriteSpecForKind(RENDER_KIND.BODY);

    expect(fruit?.key).toBe('object-fruit');
    expect(corpse?.key).toBe('object-corpse');
    expect(rock?.key).toBe('object-rock');

    expect(fruit?.primitives.length).toBeGreaterThanOrEqual(5);
    expect(corpse?.primitives.length).toBeGreaterThanOrEqual(6);
    expect(rock?.primitives.length).toBeGreaterThanOrEqual(4);

    // Cache hit returns identical object reference
    expect(getObjectSpriteSpecForKind(RENDER_KIND.FRUIT)).toBe(fruit);
    expect(getObjectSpriteSpecForKind(RENDER_KIND.CORPSE)).toBe(corpse);
    expect(getObjectSpriteSpecForKind(RENDER_KIND.BODY)).toBe(rock);
  });
});
