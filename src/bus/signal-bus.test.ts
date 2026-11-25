import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from '@core/index';
import type { PortHandle } from './ports';
import { SignalBus } from './signal-bus';

describe('SignalBus', () => {
  it('enforces one-tick delay, range clamping, analog persistence, and pulse auto-reset', () => {
    const bus = new SignalBus([
      { name: 'a.analog', kind: 'analog', range: [-1, 1], description: 'continuous' },
      { name: 'b.pulse', kind: 'pulse', range: [0, 1], description: 'event' },
      { name: 'c.pos', kind: 'analog', range: [0.5, 2], description: 'positive floor' },
    ]);

    expect(bus.channelCount).toBe(3);
    expect(bus.readIndex(2)).toBeCloseTo(0.5); // initialized inside range

    const hAnalog: PortHandle = { offset: 0, count: 1, kind: 'analog', range: [-1, 1] };
    const hPulse: PortHandle = { offset: 1, count: 1, kind: 'pulse', range: [0, 1] };

    // Write goes to next, not visible in current until swap()
    bus.writer.set(hAnalog, 5); // clamped to 1
    bus.writer.set(hPulse, 1);
    expect(bus.reader.get(hAnalog)).toBe(0);
    expect(bus.reader.get(hPulse)).toBe(0);

    bus.swap();
    expect(bus.reader.get(hAnalog)).toBe(1);
    expect(bus.reader.get(hPulse)).toBe(1);
    expect(bus.snapshot()).toEqual({ 'a.analog': 1, 'b.pulse': 1, 'c.pos': 0.5 });

    // Next swap without new writes: analog persists, pulse resets to 0
    bus.swap();
    expect(bus.reader.get(hAnalog)).toBe(1);
    expect(bus.reader.get(hPulse)).toBe(0);

    bus.writer.set(hAnalog, -5); // clamped to -1
    bus.swap();
    expect(bus.reader.get(hAnalog)).toBe(-1);
  });

  it('executes sum, max, min, and avg merge operations during swap', () => {
    const bus = new SignalBus(
      [
        { name: 's0', kind: 'analog', range: [0, 1], description: 'src 0' },
        { name: 's1', kind: 'analog', range: [0, 1], description: 'src 1' },
        { name: 'sum', kind: 'analog', range: [0, 1], description: 'sum' },
        { name: 'max', kind: 'analog', range: [0, 1], description: 'max' },
        { name: 'min', kind: 'analog', range: [0, 1], description: 'min' },
        { name: 'avg', kind: 'analog', range: [0, 1], description: 'avg' },
      ],
      [
        { sources: [0, 1], target: 2, policy: 'sum' },
        { sources: [0, 1], target: 3, policy: 'max' },
        { sources: [0, 1], target: 4, policy: 'min' },
        { sources: [0, 1], target: 5, policy: 'avg' },
      ],
    );

    bus.writeIndex(0, 0.3);
    bus.writeIndex(1, 0.9);
    bus.swap();

    expect(bus.readIndex(2)).toBeCloseTo(1.0); // 1.2 clamped to 1.0
    expect(bus.readIndex(3)).toBeCloseTo(0.9);
    expect(bus.readIndex(4)).toBeCloseTo(0.3);
    expect(bus.readIndex(5)).toBeCloseTo(0.6);
  });

  it('rejects out-of-range indices and NaN writes', () => {
    const bus = new SignalBus([{ name: 'x', kind: 'analog', range: [0, 1], description: 'x' }]);
    const h: PortHandle = { offset: 0, count: 1, kind: 'analog', range: [0, 1] };

    expect(() => bus.readIndex(-1)).toThrow(InvalidParameterError);
    expect(() => bus.readIndex(1)).toThrow(InvalidParameterError);
    expect(() => bus.writeIndex(1, 0.5)).toThrow(InvalidParameterError);
    expect(() => bus.writeIndex(0, Number.NaN)).toThrow(InvalidParameterError);
    expect(() => bus.reader.get(h, 1)).toThrow(InvalidParameterError);
    expect(() => bus.writer.set(h, 0.5, -1)).toThrow(InvalidParameterError);
  });
});
