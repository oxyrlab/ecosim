import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { SignalBus } from '@bus/signal-bus';
import { createSeededRng } from '@core/index';
import { behaviorArbiterModule, behaviorArbiterParamsSchema } from './behavior-arbiter';

function hAt(
  offset: number,
  range: readonly [number, number],
  kind: 'analog' | 'pulse' = 'analog',
): PortHandle {
  return { offset, count: 1, kind, range };
}

describe('behavior-arbiter module', () => {
  it('picks the slot with highest weighted urgency and forwards bite pulse', () => {
    const params = behaviorArbiterParamsSchema.parse({
      slots: ['flee', 'forage', 'wander'],
      weights: { flee: 1.5 },
    });
    const specs = [
      { name: 'bite.in', kind: 'pulse' as const, range: [0, 1] as const, description: 'b' },
      { name: 'flee.urgency', kind: 'analog' as const, range: [0, 1] as const, description: 'fu' },
      { name: 'flee.turn', kind: 'analog' as const, range: [-1, 1] as const, description: 'ft' },
      { name: 'flee.forward', kind: 'analog' as const, range: [-1, 1] as const, description: 'ff' },
      {
        name: 'forage.urgency',
        kind: 'analog' as const,
        range: [0, 1] as const,
        description: 'ou',
      },
      { name: 'forage.turn', kind: 'analog' as const, range: [-1, 1] as const, description: 'ot' },
      {
        name: 'forage.forward',
        kind: 'analog' as const,
        range: [-1, 1] as const,
        description: 'of',
      },
      {
        name: 'wander.urgency',
        kind: 'analog' as const,
        range: [0, 1] as const,
        description: 'wu',
      },
      { name: 'wander.turn', kind: 'analog' as const, range: [-1, 1] as const, description: 'wt' },
      {
        name: 'wander.forward',
        kind: 'analog' as const,
        range: [-1, 1] as const,
        description: 'wf',
      },
      { name: 'move.forward', kind: 'analog' as const, range: [-1, 1] as const, description: 'mf' },
      { name: 'move.turn', kind: 'analog' as const, range: [-1, 1] as const, description: 'mt' },
      { name: 'action.bite', kind: 'pulse' as const, range: [0, 1] as const, description: 'ab' },
    ];
    const bus = new SignalBus(specs);
    const h = (idx: number) => {
      const s = specs[idx] as (typeof specs)[number];
      return hAt(idx, s.range, s.kind);
    };

    const inst = behaviorArbiterModule.create(
      params,
      {
        inputs: {
          'bite.in': h(0),
          'flee.urgency': h(1),
          'flee.turn': h(2),
          'flee.forward': h(3),
          'forage.urgency': h(4),
          'forage.turn': h(5),
          'forage.forward': h(6),
          'wander.urgency': h(7),
          'wander.turn': h(8),
          'wander.forward': h(9),
        },
        outputs: {
          'move.forward': h(10),
          'move.turn': h(11),
          'action.bite': h(12),
        },
        publish: {},
        subscribe: {},
      },
      createSeededRng(1),
    );

    // Forage wins over wander
    bus.writer.set(h(7), 0.2);
    bus.writer.set(h(9), 0.3);
    bus.writer.set(h(4), 0.7);
    bus.writer.set(h(6), 0.8);
    bus.writer.set(h(5), -0.4);
    bus.writer.set(h(0), 1);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    expect(bus.reader.get(h(10))).toBeCloseTo(0.8);
    expect(bus.reader.get(h(11))).toBeCloseTo(-0.4);
    expect(bus.reader.get(h(12))).toBe(1);
    expect(inst.serialize?.()).toEqual({ activeSlot: 'forage' });

    // Weighted flee (0.6 * 1.5 = 0.9) beats forage (0.7)
    bus.writer.set(h(1), 0.6);
    bus.writer.set(h(3), 1);
    bus.writer.set(h(2), 0.9);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    expect(bus.reader.get(h(10))).toBeCloseTo(1);
    expect(bus.reader.get(h(11))).toBeCloseTo(0.9);
    expect(inst.serialize?.()).toEqual({ activeSlot: 'flee' });
  });
});
