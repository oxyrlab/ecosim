import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { SignalBus } from '@bus/signal-bus';
import { createSeededRng } from '@core/index';
import { randomWanderModule, randomWanderParamsSchema } from './random-wander';

function hAt(offset: number, range: readonly [number, number]): PortHandle {
  return { offset, count: 1, kind: 'analog', range };
}

describe('random-wander module', () => {
  it('produces deterministic exploration steering from seeded RNG and serializes state', () => {
    const params = randomWanderParamsSchema.parse({ turnIntervalSeconds: 0.5 });

    const run = (): number[] => {
      const bus = new SignalBus([
        { name: 'urgency', kind: 'analog', range: [0, 1], description: 'u' },
        { name: 'turn', kind: 'analog', range: [-1, 1], description: 't' },
        { name: 'forward', kind: 'analog', range: [-1, 1], description: 'f' },
      ]);
      const urgency = hAt(0, [0, 1]);
      const turn = hAt(1, [-1, 1]);
      const forward = hAt(2, [-1, 1]);
      const inst = randomWanderModule.create(
        params,
        { inputs: {}, outputs: { urgency, turn, forward }, publish: {}, subscribe: {} },
        createSeededRng(42),
      );
      const turns: number[] = [];
      for (let i = 0; i < 6; i += 1) {
        inst.tick(bus.reader, bus.writer, 0.25);
        bus.swap();
        turns.push(bus.reader.get(turn));
        expect(bus.reader.get(urgency)).toBeCloseTo(params.baseUrgency);
        expect(bus.reader.get(forward)).toBeCloseTo(params.cruiseSpeed);
      }
      expect(inst.serialize?.()).toBeDefined();
      return turns;
    };

    const a = run();
    const b = run();
    expect(a).toEqual(b);
  });
});
