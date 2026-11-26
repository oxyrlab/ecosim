import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { SignalBus } from '@bus/signal-bus';
import { createSeededRng } from '@core/index';
import { rabbitFleePredatorModule, rabbitFleePredatorParamsSchema } from './flee-predator';

function hAt(
  offset: number,
  range: readonly [number, number],
  kind: 'analog' | 'pulse' = 'analog',
): PortHandle {
  return { offset, count: 1, kind, range };
}

describe('rabbit-flee-predator module', () => {
  it('steers away from visible or scented predators, latches pain fear, and publishes hormone.fear', () => {
    const params = rabbitFleePredatorParamsSchema.parse({});
    const specs = [
      { name: 'seen.predator', kind: 'analog' as const, range: [0, 1] as const, description: 'sp' },
      { name: 'dir.predator', kind: 'analog' as const, range: [-1, 1] as const, description: 'dp' },
      {
        name: 'scent.intensity',
        kind: 'analog' as const,
        range: [0, 1] as const,
        description: 'si',
      },
      {
        name: 'scent.gradient',
        kind: 'analog' as const,
        range: [-1, 1] as const,
        description: 'sg',
      },
      { name: 'pain', kind: 'pulse' as const, range: [0, 1] as const, description: 'p' },
      { name: 'urgency', kind: 'analog' as const, range: [0, 1] as const, description: 'u' },
      { name: 'turn', kind: 'analog' as const, range: [-1, 1] as const, description: 't' },
      { name: 'forward', kind: 'analog' as const, range: [-1, 1] as const, description: 'f' },
      {
        name: 'hormone.adrenaline',
        kind: 'analog' as const,
        range: [0, 1] as const,
        description: 'hf',
      },
    ];
    const bus = new SignalBus(specs);
    const h = (idx: number) => {
      const s = specs[idx] as (typeof specs)[number];
      return hAt(idx, s.range, s.kind);
    };

    const inst = rabbitFleePredatorModule.create(
      params,
      {
        inputs: {
          'seen.predator': h(0),
          'dir.predator': h(1),
          'scent.intensity': h(2),
          'scent.gradient': h(3),
          pain: h(4),
        },
        outputs: { urgency: h(5), turn: h(6), forward: h(7) },
        publish: { 'hormone.adrenaline': h(8) },
        subscribe: {},
      },
      createSeededRng(1),
    );

    // Predator seen to the right (+0.5) -> turn left (-1) and flee at full speed
    bus.writer.set(h(0), 0.8);
    bus.writer.set(h(1), 0.5);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    expect(bus.reader.get(h(5))).toBeGreaterThan(0.8);
    expect(bus.reader.get(h(6))).toBe(-1);
    expect(bus.reader.get(h(7))).toBe(1);
    expect(bus.reader.get(h(8))).toBeGreaterThan(0.8);
    expect(inst.serialize?.()).toBeDefined();

    // Predator disappears -> fear decays gradually and scent gradient steers away
    bus.writer.set(h(0), 0);
    bus.writer.set(h(2), 0.4);
    bus.writer.set(h(3), -0.3);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 1);
    bus.swap();
    expect(bus.reader.get(h(6))).toBeGreaterThan(0);

    // Predator seen to the left (-0.5) -> turn right (+1)
    bus.writer.set(h(0), 0.7);
    bus.writer.set(h(1), -0.5);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    expect(bus.reader.get(h(6))).toBe(1);

    // Clear threat and decay to 0 -> calm output
    bus.writer.set(h(0), 0);
    bus.writer.set(h(2), 0);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 10);
    bus.swap();
    expect(bus.reader.get(h(5))).toBe(0);
    expect(bus.reader.get(h(7))).toBe(0);
  });
});
