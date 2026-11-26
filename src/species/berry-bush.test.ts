import { describe, expect, it } from 'vitest';
import { BERRY_BUSH_BLUEPRINT } from './berry-bush';

describe('berry-bush species blueprint', () => {
  it('defines a valid fruiting berry bush plant blueprint', () => {
    expect(BERRY_BUSH_BLUEPRINT.id).toBe('berry-bush');
    expect(BERRY_BUSH_BLUEPRINT.kingdom).toBe('plant');
    expect(BERRY_BUSH_BLUEPRINT.plantSpec.fruitFleshEnergy).toBeGreaterThan(5);
  });
});
