import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRegistry, InvalidParameterError } from '@core/index';
import { defineOrgan, registerOrgan, type OrganDef } from './organ-def';

describe('organ-def', () => {
  it('validates metadata and registers organs', () => {
    const local = createRegistry<OrganDef<unknown>>('organ');
    const organ = defineOrgan({
      id: 'fin',
      description: 'Swimming fin.',
      params: z.object({}),
      defaultShape: { type: 'triangle', w: 0.1, h: 0.08 },
      sensorSlots: 0,
      actuatorSlot: true,
      massDensity: 0.7,
    });
    registerOrgan(organ, local);
    expect(local.has('fin')).toBe(true);

    expect(() => defineOrgan({ ...organ, id: 'BadId' })).toThrow(InvalidParameterError);
    expect(() => defineOrgan({ ...organ, description: ' ' })).toThrow(InvalidParameterError);
    expect(() => defineOrgan({ ...organ, sensorSlots: -1 })).toThrow(InvalidParameterError);
    expect(() => defineOrgan({ ...organ, massDensity: 0 })).toThrow(InvalidParameterError);
  });
});
