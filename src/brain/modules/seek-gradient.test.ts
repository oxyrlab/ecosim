import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { SignalBus } from '@bus/signal-bus';
import { createSeededRng } from '@core/index';
import { seekGradientModule, seekGradientParamsSchema } from './seek-gradient';

function hAt(
  offset: number,
  range: readonly [number, number],
  kind: 'analog' | 'pulse' = 'analog',
): PortHandle {
  return { offset, count: 1, kind, range };
}

describe('seek-gradient module', () => {
  it('steers by vision when visible, falls back to olfactory gradient, and bites when close', () => {
    const params = seekGradientParamsSchema.parse({});
    const bus = new SignalBus([
      { name: 'drive', kind: 'analog', range: [0, 1], description: 'd' },
      { name: 'seen', kind: 'analog', range: [0, 1], description: 's' },
      { name: 'dir', kind: 'analog', range: [-1, 1], description: 'dir' },
      { name: 'scent.intensity', kind: 'analog', range: [0, 1], description: 'si' },
      { name: 'scent.gradient', kind: 'analog', range: [-1, 1], description: 'sg' },
      { name: 'urgency', kind: 'analog', range: [0, 1], description: 'u' },
      { name: 'turn', kind: 'analog', range: [-1, 1], description: 't' },
      { name: 'forward', kind: 'analog', range: [-1, 1], description: 'f' },
      { name: 'bite', kind: 'pulse', range: [0, 1], description: 'b' },
    ]);

    const h = {
      drive: hAt(0, [0, 1]),
      seen: hAt(1, [0, 1]),
      dir: hAt(2, [-1, 1]),
      si: hAt(3, [0, 1]),
      sg: hAt(4, [-1, 1]),
      urgency: hAt(5, [0, 1]),
      turn: hAt(6, [-1, 1]),
      forward: hAt(7, [-1, 1]),
      bite: hAt(8, [0, 1], 'pulse'),
    };

    const inst = seekGradientModule.create(
      params,
      {
        inputs: {
          drive: h.drive,
          seen: h.seen,
          dir: h.dir,
          'scent.intensity': h.si,
          'scent.gradient': h.sg,
        },
        outputs: { urgency: h.urgency, turn: h.turn, forward: h.forward, bite: h.bite },
        publish: {},
        subscribe: {},
      },
      createSeededRng(1),
    );

    // 1. Scent-only tracking (stronger to the right -> positive turn)
    bus.writer.set(h.drive, 0.8);
    bus.writer.set(h.si, 0.5);
    bus.writer.set(h.sg, 0.2);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    expect(bus.reader.get(h.urgency)).toBeGreaterThan(0);
    expect(bus.reader.get(h.turn)).toBeGreaterThan(0);
    expect(bus.reader.get(h.bite)).toBe(0);

    // 2. Close visual target overrides scent and triggers bite pulse
    bus.writer.set(h.seen, 0.9);
    bus.writer.set(h.dir, -0.4);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    expect(bus.reader.get(h.turn)).toBeLessThan(0);
    expect(bus.reader.get(h.bite)).toBe(1);

    // 3. No cue -> zero urgency
    bus.writer.set(h.seen, 0);
    bus.writer.set(h.si, 0);
    bus.swap();
    inst.tick(bus.reader, bus.writer, 0.1);
    bus.swap();
    expect(bus.reader.get(h.urgency)).toBe(0);
  });
});
