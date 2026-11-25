import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRegistry, InvalidParameterError } from '@core/index';
import { defineShape, registerShape, type ShapeDef } from './shape-def';

describe('shape-def', () => {
  it('validates metadata and registers shapes into a registry', () => {
    const local = createRegistry<ShapeDef<unknown>>('shape');
    const def = defineShape({
      id: 'dot',
      description: 'Test circular dot.',
      params: z.object({ r: z.number().positive() }),
      bounds: (p) => ({ w: p.r * 2, h: p.r * 2 }),
      toPath: (p) => [
        { kind: 'arc', cx: 0, cy: 0, radius: p.r, startAngle: 0, endAngle: Math.PI * 2 },
        { kind: 'closePath' },
      ],
      toColliders: (p) => [{ shape: { kind: 'circle', radius: p.r } }],
      isConvex: () => true,
      scaleParams: (p, s) => ({ r: p.r * s }),
      area: (p) => Math.PI * p.r * p.r,
    });

    registerShape(def, local);
    expect(local.has('dot')).toBe(true);

    expect(() => defineShape({ ...def, id: 'BadId' })).toThrow(InvalidParameterError);
    expect(() => defineShape({ ...def, description: '   ' })).toThrow(InvalidParameterError);
  });
});
