import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createEntityId, InvalidParameterError } from '@core/index';
import { SpatialHash } from './spatial-hash';

describe('SpatialHash', () => {
  it('inserts, updates, queries by radius/rect, removes, and clears', () => {
    const hash = new SpatialHash(2);
    const e1 = createEntityId(1);
    const e2 = createEntityId(2);
    const e3 = createEntityId(3);

    hash.insert(e3, 1.5, 1.5, 0.5);
    hash.insert(e1, 0.5, 0.5, 0.2);
    hash.insert(e2, 10, 10, 0.3);

    expect(hash.size).toBe(3);
    expect(hash.queryRadius(1, 1, 1.5)).toEqual([e1, e3]);
    expect(hash.queryRect(0, 0, 2, 2)).toEqual([e1, e3]);

    hash.update(e2, 1.0, 1.0, 0.1);
    expect(hash.queryRadius(1, 1, 1.5)).toEqual([e1, e2, e3]);

    hash.remove(e1);
    hash.remove(e1); // idempotent
    expect(hash.size).toBe(2);
    expect(hash.queryRadius(1, 1, 1.5)).toEqual([e2, e3]);

    hash.clear();
    expect(hash.size).toBe(0);
    expect(hash.queryRadius(1, 1, 5)).toEqual([]);
  });

  it('rejects invalid parameters', () => {
    expect(() => new SpatialHash(0)).toThrow(InvalidParameterError);
    const hash = new SpatialHash(2);
    expect(() => hash.insert(createEntityId(1), 0, 0, -1)).toThrow(InvalidParameterError);
    expect(() => hash.queryRadius(0, 0, -1)).toThrow(InvalidParameterError);
    expect(() => hash.queryRect(5, 0, 1, 5)).toThrow(InvalidParameterError);
  });

  it('matches brute-force radius search across arbitrary positions (property-based)', () => {
    const coord = fc.double({ min: -20, max: 20, noNaN: true, noDefaultInfinity: true });
    const rad = fc.double({ min: 0, max: 3, noNaN: true, noDefaultInfinity: true });

    fc.assert(
      fc.property(
        fc.array(fc.record({ x: coord, y: coord, r: rad }), { minLength: 1, maxLength: 30 }),
        coord,
        coord,
        fc.double({ min: 0, max: 8, noNaN: true, noDefaultInfinity: true }),
        (items, qx, qy, qr) => {
          const hash = new SpatialHash(2.5);
          items.forEach((item, idx) => {
            hash.insert(createEntityId(idx + 1), item.x, item.y, item.r);
          });

          const expected: number[] = [];
          items.forEach((item, idx) => {
            const dx = item.x - qx;
            const dy = item.y - qy;
            const limit = qr + item.r;
            if (dx * dx + dy * dy <= limit * limit) {
              expected.push(idx + 1);
            }
          });

          expect(hash.queryRadius(qx, qy, qr)).toEqual(expected);
        },
      ),
    );
  });
});
