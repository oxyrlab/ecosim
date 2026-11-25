import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import { GridField } from './field';

describe('GridField', () => {
  it('validates constructor parameters', () => {
    expect(() => new GridField({ name: ' ', cols: 4, rows: 4, cellSizeMeters: 1 })).toThrow(
      InvalidParameterError,
    );
    expect(() => new GridField({ name: 'scent', cols: 0, rows: 4, cellSizeMeters: 1 })).toThrow(
      InvalidParameterError,
    );
    expect(() => new GridField({ name: 'scent', cols: 4, rows: -1, cellSizeMeters: 1 })).toThrow(
      InvalidParameterError,
    );
    expect(() => new GridField({ name: 'scent', cols: 4, rows: 4, cellSizeMeters: 0 })).toThrow(
      InvalidParameterError,
    );
    expect(
      () =>
        new GridField({
          name: 'scent',
          cols: 4,
          rows: 4,
          cellSizeMeters: 1,
          minValue: 5,
          maxValue: 1,
        }),
    ).toThrow(InvalidParameterError);
  });

  it('supports cell ops, world coordinates, bilinear sampling, brush painting, and decay', () => {
    const field = new GridField({
      name: 'soil.nutrients',
      cols: 4,
      rows: 4,
      cellSizeMeters: 1,
      minValue: 0,
      maxValue: 10,
      initialValue: 1,
    });

    expect(field.widthMeters).toBe(4);
    expect(field.heightMeters).toBe(4);
    expect(field.totalMass()).toBeCloseTo(16);

    field.clear();
    expect(field.totalMass()).toBe(0);

    field.addAtWorld(1.2, 1.8, 4);
    expect(field.getCell(1, 1)).toBeCloseTo(4);
    expect(field.getCell(-1, 0)).toBe(0);
    field.addAtWorld(-5, -5, 10); // ignored out of bounds
    field.setCell(1, 1, 99);
    expect(field.getCell(1, 1)).toBe(10); // clamped to maxValue
    field.setCell(99, 99, 5); // ignored
    field.addCell(99, 99, 5); // ignored

    // Bilinear interpolation at cell centers and midpoint between two cells.
    field.clear();
    field.setCell(1, 1, 2);
    field.setCell(2, 1, 6);
    expect(field.sampleBilinear(1.5, 1.5)).toBeCloseTo(2);
    expect(field.sampleBilinear(2.0, 1.5)).toBeCloseTo(4);

    // Circular brush in set & add modes
    field.clear();
    field.paintCircle(2, 2, 1.1, 3, 'set');
    expect(field.getCell(1, 1)).toBeCloseTo(3);
    expect(field.getCell(2, 2)).toBeCloseTo(3);
    field.paintCircle(2, 2, 1.1, 2, 'add');
    expect(field.getCell(2, 2)).toBeCloseTo(5);

    const massBeforeDecay = field.totalMass();
    field.decay(0.5);
    expect(field.totalMass()).toBeCloseTo(massBeforeDecay * 0.5);

    expect(() => field.diffuse(-0.1)).toThrow(InvalidParameterError);
    expect(() => field.decay(1.5)).toThrow(InvalidParameterError);
    expect(() => field.paintCircle(1, 1, -1, 1)).toThrow(InvalidParameterError);
  });

  it('conserves total mass under diffusion without decay (property-based)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }), {
          minLength: 36,
          maxLength: 36,
        }),
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (values, rate) => {
          const field = new GridField({
            name: 'scent.plant',
            cols: 6,
            rows: 6,
            cellSizeMeters: 1,
          });
          for (let i = 0; i < values.length; i += 1) {
            field.setCell(i % 6, Math.floor(i / 6), values[i] ?? 0);
          }

          const before = field.totalMass();
          field.diffuse(rate);
          field.diffuse(rate);
          const after = field.totalMass();

          // Float32 accumulation tolerance relative to total mass.
          expect(Math.abs(after - before)).toBeLessThanOrEqual(Math.max(1e-3, before * 1e-4));
        },
      ),
    );
  });
});
