import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { SignalBus } from '@bus/signal-bus';
import { createSeededRng } from '@core/index';
import { foxHuntPreyModule, foxHuntPreyParamsSchema } from './hunt-prey';

function hAt(
  offset: number,
  range: readonly [number, number],
  kind: 'analog' | 'pulse' = 'analog',
): PortHandle {
  return { offset, count: 1, kind, range };
}

describe('fox-hunt-prey module', () => {
  it('stalks prey scent, sprints toward visible prey, and triggers bite at close range', () => {
    const params = foxHuntPreyParamsSchema.parse({});
    const specs = [
      { name: 'drive', kind: 'analog' as const, range: [0, 1] as const, description: 'd' },
      { name: 'seen.prey', kind: 'analog' as const, range: [0, 1] as const, description: 'sp' },
      { name: 'dir.prey', kind: 'analog' as const, range: [-1, 1] as const, description: 'dp' },
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
      { name: 'urgency', kind: 'analog' as const, range: [0, 1] as const, description: 'u' },
      { name: 'turn', kind: 'analog' as const, range: [-1, 1] as const, description: 't' },
      { name: 'forward', kind: 'analog' as const, range: [-1, 1] as const, description: 'f' },
      { name: 'bite', kind: 'pulse' as const, range: [0, 1] as const, description: 'b' },
    ];
    const bus = new SignalBus(specs);
    const h = (idx: number) => {
      const s = specs[idx] as (typeof specs)[number];
      return hAt(idx, s.range, s.kind);
    };

    const inst = foxHuntPreyModule.create(
      params,
      {
        inputs: {
          drive: h(0),
          'seen.prey': h(1),
          'dir.prey': h(2),
          'scent.intensity': h(3),
          'scent.gradient': h(4),
        },
        outputs: { urgency: h(5), turn: h(6), forward: h(7), bite: h(8) },
        publish: {},
        subscribe: {},
      },
      createSeededRng(1),
    );

    // Scent tracking
    bus.writer.set(h(0), 0.6);
    bus.writer.set(h(3), 0.4);
    bus.writer.set(h(4), 0.25);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    expect(bus.reader.get(h(5))).toBeGreaterThan(0);
    expect(bus.reader.get(h(6))).toBeGreaterThan(0);
    expect(bus.reader.get(h(8))).toBe(0);

    // Close visual prey -> chase & bite (slows gently while aligning to off-center target)
    bus.writer.set(h(1), 0.9);
    bus.writer.set(h(2), -0.2);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    expect(bus.reader.get(h(7))).toBeGreaterThan(params.chaseSpeed * 0.7);
    expect(bus.reader.get(h(7))).toBeLessThanOrEqual(params.chaseSpeed);
    expect(bus.reader.get(h(8))).toBe(1);
  });
});
