import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { DEFAULT_FIELD_NAMES, FieldSet } from './field-set';

describe('FieldSet', () => {
  it('initializes all default fields and advances diffusion/decay', () => {
    const fields = new FieldSet({ cols: 8, rows: 8, cellSizeMeters: 1 });
    expect(fields.names()).toEqual(DEFAULT_FIELD_NAMES);
    expect(fields.has('scent.plant')).toBe(true);
    expect(fields.has('nonexistent')).toBe(false);

    expect(fields.get('light').getCell(0, 0)).toBe(1);
    expect(fields.get('soil.moisture').getCell(0, 0)).toBeCloseTo(0.5);

    fields.paintField('scent.plant', 4, 4, 1.2, 5, 'set');
    const before = fields.get('scent.plant').totalMass();
    fields.stepDiffusion();
    const after = fields.get('scent.plant').totalMass();
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  it('throws InvalidParameterError when accessing an unknown field', () => {
    const fields = new FieldSet({ cols: 4, rows: 4, cellSizeMeters: 1 });
    expect(() => fields.get('unknown.field')).toThrow(InvalidParameterError);
  });
});
