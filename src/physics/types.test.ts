import { describe, expect, it } from 'vitest';
import { COLLISION_GROUP } from './types';

describe('COLLISION_GROUP', () => {
  it('defines distinct single-bit category masks covered by ALL', () => {
    const groups = [
      COLLISION_GROUP.CREATURE,
      COLLISION_GROUP.PLANT,
      COLLISION_GROUP.FRUIT,
      COLLISION_GROUP.WALL,
    ];
    let combined = 0;
    for (const g of groups) {
      expect(combined & g).toBe(0);
      expect(COLLISION_GROUP.ALL & g).toBe(g);
      combined |= g;
    }
  });
});
