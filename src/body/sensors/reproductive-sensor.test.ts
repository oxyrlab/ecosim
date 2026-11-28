import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { resolveWiring } from '@bus/wiring';
import { createEntityId } from '@core/index';
import { reproductiveSensor } from './reproductive-sensor';
import { resolvePortMap, type SensorContext } from './sensor-def';

describe('reproductiveSensor', () => {
  it('signals contact and mate bearing only for complementary conspecific organs', () => {
    const params = reproductiveSensor.params.parse({
      detectionRadiusMeters: 5,
      minReadyEnergyRatio: 0.5,
    });
    const outputs = resolvePortMap(reproductiveSensor.outputs, params);
    const { bus, handles } = resolveWiring([{ instanceId: 'repro', inputs: {}, outputs }], []);
    const outH = handles.get('repro')?.outputs as {
      contact: PortHandle;
      'mate.near': PortHandle;
      'mate.dir': PortHandle;
      ready: PortHandle;
    };
    const inst = reproductiveSensor.create(params, { outputs: outH });

    const selfId = createEntityId(1);
    const sameSexId = createEntityId(2);
    const mateId = createEntityId(3);
    const otherSpeciesId = createEntityId(4);

    const ctx: SensorContext = {
      entityId: selfId,
      position: { x: 10, y: 10 },
      angle: 0,
      bodyState: {
        energyRatio: 0.75,
        healthRatio: 1,
        painPulse: 0,
        isMature: true,
        speciesId: 'rabbit',
        reproductiveOrgan: {
          organId: 'reproductive-female',
          speciesId: 'rabbit',
          worldPosition: { x: 10, y: 10 },
          contactRadiusMeters: 0.25,
        },
      },
      queryNeighbors: () => [
        {
          entityId: sameSexId,
          position: { x: 10.1, y: 10 },
          radius: 0.3,
          tags: new Set(['rabbit']),
          reproductiveOrgan: {
            organId: 'reproductive-female',
            speciesId: 'rabbit',
            worldPosition: { x: 10.1, y: 10 },
            contactRadiusMeters: 0.25,
          },
        },
        {
          entityId: otherSpeciesId,
          position: { x: 10.1, y: 10 },
          radius: 0.3,
          tags: new Set(['fox']),
          reproductiveOrgan: {
            organId: 'reproductive-male',
            speciesId: 'fox',
            worldPosition: { x: 10.1, y: 10 },
            contactRadiusMeters: 0.25,
          },
        },
        {
          entityId: mateId,
          position: { x: 10.3, y: 10.1 },
          radius: 0.3,
          tags: new Set(['rabbit']),
          reproductiveOrgan: {
            organId: 'reproductive-male',
            speciesId: 'rabbit',
            worldPosition: { x: 10.3, y: 10.1 },
            contactRadiusMeters: 0.25,
          },
        },
      ],
      sampleField: () => 0,
      castRay: () => null,
    };

    inst.sample(ctx, bus.writer);
    bus.swap();

    expect(bus.reader.get(outH.ready)).toBe(1);
    expect(bus.reader.get(outH.contact)).toBe(1);
    expect(bus.reader.get(outH['mate.near'])).toBeGreaterThan(0.9);
    expect(bus.reader.get(outH['mate.dir'])).toBeGreaterThan(0);

    // Without an organ on self, signals are zeroed cleanly
    inst.sample(
      { ...ctx, bodyState: { energyRatio: 0.2, healthRatio: 1, painPulse: 0, isMature: false } },
      bus.writer,
    );
    bus.swap();
    expect(bus.reader.get(outH.ready)).toBe(0);
    expect(bus.reader.get(outH.contact)).toBe(0);
    expect(bus.reader.get(outH['mate.near'])).toBe(0);
  });
});
