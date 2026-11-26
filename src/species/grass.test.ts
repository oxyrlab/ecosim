import { describe, expect, it } from 'vitest';
import { GRASS_BLUEPRINT } from './grass';

describe('grass species blueprint', () => {
  it('defines a valid self-pollinating meadow grass plant blueprint', () => {
    expect(GRASS_BLUEPRINT.id).toBe('grass');
    expect(GRASS_BLUEPRINT.kingdom).toBe('plant');
    expect(GRASS_BLUEPRINT.tags).toContain('plant');
    expect(GRASS_BLUEPRINT.plantSpec.selfPollinationProbabilityPerSecond).toBeGreaterThan(0);
  });
});
