import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { SignalBus } from '@bus/signal-bus';
import { createSeededRng } from '@core/index';
import { nnControllerModule, nnControllerParamsSchema } from './nn-module';

describe('nn-controller module', () => {
  it('runs deterministic feedforward inference and restores explicit evolved weights', () => {
    const params = nnControllerParamsSchema.parse({
      inputCount: 2,
      hiddenSizes: [3],
      outputCount: 2,
    });
    const bus = new SignalBus([
      { name: 'in.0', kind: 'analog', range: [-1, 1], description: 'i0' },
      { name: 'in.1', kind: 'analog', range: [-1, 1], description: 'i1' },
      { name: 'out.0', kind: 'analog', range: [-1, 1], description: 'o0' },
      { name: 'out.1', kind: 'analog', range: [-1, 1], description: 'o1' },
    ]);
    const inH: PortHandle = { offset: 0, count: 2, kind: 'analog', range: [-1, 1] };
    const outH: PortHandle = { offset: 2, count: 2, kind: 'analog', range: [-1, 1] };

    const inst1 = nnControllerModule.create(
      params,
      { inputs: { in: inH }, outputs: { out: outH }, publish: {}, subscribe: {} },
      createSeededRng(11),
    );
    bus.writer.set(inH, 0.5, 0);
    bus.writer.set(inH, -0.25, 1);
    bus.swap();
    inst1.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    const outA = [bus.reader.get(outH, 0), bus.reader.get(outH, 1)];
    const serialized = inst1.serialize?.() as { weights: number[]; stateSize: number };
    expect(serialized.stateSize).toBe(serialized.weights.length);

    // Restoring serialized weights produces identical output regardless of RNG seed
    const inst2 = nnControllerModule.create(
      { ...params, weights: serialized.weights },
      { inputs: { in: inH }, outputs: { out: outH }, publish: {}, subscribe: {} },
      createSeededRng(999),
    );
    bus.writer.set(inH, 0.5, 0);
    bus.writer.set(inH, -0.25, 1);
    bus.swap();
    inst2.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    expect([bus.reader.get(outH, 0), bus.reader.get(outH, 1)]).toEqual(outA);
  });
});
