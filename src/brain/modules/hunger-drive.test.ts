import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { SignalBus } from '@bus/signal-bus';
import { createSeededRng } from '@core/index';
import { hungerDriveModule, hungerDriveParamsSchema } from './hunger-drive';

function makeHandle(offset: number, range: readonly [number, number]): PortHandle {
  return { offset, count: 1, kind: 'analog', range };
}

describe('hunger-drive module', () => {
  it('maps deficit below threshold to 0 and rises smoothly above threshold, publishing hormone.satiety', () => {
    const params = hungerDriveParamsSchema.parse({ threshold: 0.2, exponent: 1, gain: 1 });
    const bus = new SignalBus([
      { name: 'deficit', kind: 'analog', range: [0, 1], description: 'd' },
      { name: 'urge', kind: 'analog', range: [0, 1], description: 'u' },
      { name: 'hormone.satiety', kind: 'analog', range: [0, 1], description: 'h' },
    ]);
    const deficitH = makeHandle(0, [0, 1]);
    const urgeH = makeHandle(1, [0, 1]);
    const hormoneH = makeHandle(2, [0, 1]);

    const inst = hungerDriveModule.create(
      params,
      {
        inputs: { deficit: deficitH },
        outputs: { urge: urgeH },
        publish: { 'hormone.satiety': hormoneH },
        subscribe: {},
      },
      createSeededRng(1),
    );

    bus.writer.set(deficitH, 0.1);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    expect(bus.reader.get(urgeH)).toBe(0);
    expect(bus.reader.get(hormoneH)).toBe(1);

    bus.writer.set(deficitH, 0.6);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    expect(bus.reader.get(urgeH)).toBeCloseTo(0.5);
    expect(bus.reader.get(hormoneH)).toBeCloseTo(0.5);
  });
});
