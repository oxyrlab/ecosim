import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { SignalBus } from '@bus/signal-bus';
import { createSeededRng } from '@core/index';
import { threatMemoryModule, threatMemoryParamsSchema } from './threat-memory';

function setupThreatMemory(overrides: Record<string, unknown> = {}) {
  const params = threatMemoryParamsSchema.parse(overrides);
  const specs = [
    { name: 'nearest.seen', kind: 'analog' as const, range: [0, 1] as const, description: 's' },
    { name: 'nearest.dir', kind: 'analog' as const, range: [-1, 1] as const, description: 'd' },
    { name: 'nearest.size', kind: 'analog' as const, range: [0, 1] as const, description: 'sz' },
    { name: 'nearest.hue', kind: 'analog' as const, range: [0, 1] as const, description: 'h' },
    {
      name: 'nearest.lightness',
      kind: 'analog' as const,
      range: [0, 1] as const,
      description: 'l',
    },
    { name: 'nearest.shape', kind: 'analog' as const, range: [0, 1] as const, description: 'sh' },
    { name: 'nearest.parts', kind: 'analog' as const, range: [0, 1] as const, description: 'p' },
    { name: 'pain', kind: 'pulse' as const, range: [0, 1] as const, description: 'pain' },
    {
      name: 'hormone.aversive',
      kind: 'analog' as const,
      range: [0, 1] as const,
      description: 'av',
    },
    { name: 'predictedDanger', kind: 'analog' as const, range: [0, 1] as const, description: 'pd' },
    { name: 'dangerTurn', kind: 'analog' as const, range: [-1, 1] as const, description: 'dt' },
    { name: 'urgency', kind: 'analog' as const, range: [0, 1] as const, description: 'u' },
    { name: 'turn', kind: 'analog' as const, range: [-1, 1] as const, description: 't' },
    { name: 'forward', kind: 'analog' as const, range: [-1, 1] as const, description: 'f' },
  ];
  const bus = new SignalBus(specs);
  const h = (idx: number): PortHandle => {
    const s = specs[idx] as (typeof specs)[number];
    return { offset: idx, count: 1, kind: s.kind, range: s.range };
  };
  const inst = threatMemoryModule.create(
    params,
    {
      inputs: {
        'nearest.seen': h(0),
        'nearest.dir': h(1),
        'nearest.size': h(2),
        'nearest.hue': h(3),
        'nearest.lightness': h(4),
        'nearest.shape': h(5),
        'nearest.parts': h(6),
        pain: h(7),
      },
      outputs: {
        predictedDanger: h(9),
        dangerTurn: h(10),
        urgency: h(11),
        turn: h(12),
        forward: h(13),
      },
      publish: {},
      subscribe: { 'hormone.aversive': h(8) },
    },
    createSeededRng(1),
  );
  return { bus, h, inst };
}

describe('threat-memory conditioning, extinction, and generalization (Section 9.4)', () => {
  it('conditions after 3 episodes (>0.6), generalizes to similar appearances, and extinguishes after 20 safe sightings (<0.2)', () => {
    const { bus, h, inst } = setupThreatMemory();
    const predatorX = [0.6, 0.1, 0.4, 0.7, 0.5] as const;
    const similarX = [0.58, 0.14, 0.42, 0.65, 0.48] as const;
    const dissimilarY = [0.15, 0.85, 0.9, 0.1, 0.1] as const;

    const show = (feat: readonly [number, number, number, number, number], pain = 0, dt = 0.3) => {
      bus.writer.set(h(0), 0.7);
      bus.writer.set(h(1), 0.4);
      bus.writer.set(h(2), feat[0]);
      bus.writer.set(h(3), feat[1]);
      bus.writer.set(h(4), feat[2]);
      bus.writer.set(h(5), feat[3]);
      bus.writer.set(h(6), feat[4]);
      bus.writer.set(h(7), pain);
      bus.swap();
      inst.tick(bus.reader, bus.writer, dt);
      bus.swap();
      return bus.reader.get(h(9));
    };

    // Starts with empty memory -> zero predicted danger
    expect(show(predatorX, 0)).toBe(0);

    // 3 episodes of "see appearance X, then pain"
    for (let ep = 0; ep < 3; ep += 1) {
      show(predatorX, 0, 0.3);
      show(predatorX, 1, 0.3);
    }

    // Seeing X alone now predicts danger > 0.6
    const dangerX = show(predatorX, 0, 0.3);
    expect(dangerX).toBeGreaterThan(0.6);
    expect(bus.reader.get(h(10))).toBe(-1); // turns away from +0.4 bearing

    // Generalization: similar appearance X' elicits partial positive danger, dissimilar Y near 0
    const dangerSimilar = show(similarX, 0, 0.05);
    const dangerDissimilar = show(dissimilarY, 0, 0.05);
    expect(dangerSimilar).toBeGreaterThan(0.2);
    expect(dangerSimilar).toBeLessThan(dangerX);
    expect(dangerDissimilar).toBeLessThan(0.05);

    // Extinction: 20 sightings of X without pain drops predictedDanger below 0.2
    let afterExtinction = dangerX;
    for (let i = 0; i < 20; i += 1) {
      afterExtinction = show(predatorX, 0, 0.3);
    }
    expect(afterExtinction).toBeLessThan(0.2);
    expect(inst.serialize?.()).toBeDefined();

    // Slot eviction when memorySlots is full (2 slots, 3 distinct painful patterns)
    const small = setupThreatMemory({ memorySlots: 2 });
    const p1 = [0.1, 0.1, 0.1, 0.1, 0.1] as const;
    const p2 = [0.5, 0.5, 0.5, 0.5, 0.5] as const;
    const p3 = [0.9, 0.9, 0.9, 0.9, 0.9] as const;
    for (const pat of [p1, p2, p3]) {
      small.bus.writer.set(small.h(0), 0.8);
      small.bus.writer.set(small.h(1), -0.3);
      small.bus.writer.set(small.h(2), pat[0]);
      small.bus.writer.set(small.h(3), pat[1]);
      small.bus.writer.set(small.h(4), pat[2]);
      small.bus.writer.set(small.h(5), pat[3]);
      small.bus.writer.set(small.h(6), pat[4]);
      small.bus.writer.set(small.h(7), 1);
      small.bus.swap();
      small.inst.tick(small.bus.reader, small.bus.writer, 0.4);
      small.bus.swap();
    }
    const ser = small.inst.serialize?.() as { usedSlots: number[]; totalLearnUpdates: number };
    expect(ser.usedSlots).toEqual([1, 1]);
    expect(ser.totalLearnUpdates).toBe(3);
  });
});
