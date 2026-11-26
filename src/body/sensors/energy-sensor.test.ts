import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { resolveWiring } from '@bus/wiring';
import { createEntityId } from '@core/index';
import { energySensor } from './energy-sensor';
import { resolvePortMap, type SensorContext } from './sensor-def';

describe('energySensor', () => {
  it('outputs normalized energy level and deficit from bodyState', () => {
    const params = energySensor.params.parse(undefined);
    const outputs = resolvePortMap(energySensor.outputs, params);
    const { bus, handles } = resolveWiring([{ instanceId: 'ener', inputs: {}, outputs }], []);
    const outH = handles.get('ener')?.outputs as { level: PortHandle; deficit: PortHandle };
    const sensor = energySensor.create(params, { outputs: outH });

    const baseCtx: SensorContext = {
      entityId: createEntityId(1),
      position: { x: 0, y: 0 },
      angle: 0,
      queryNeighbors: () => [],
      sampleField: () => 0,
      castRay: () => null,
    };

    sensor.sample(
      { ...baseCtx, bodyState: { energyRatio: 0.3, healthRatio: 1, painPulse: 0 } },
      bus.writer,
    );
    bus.swap();
    expect(bus.reader.get(outH.level)).toBeCloseTo(0.3);
    expect(bus.reader.get(outH.deficit)).toBeCloseTo(0.7);

    // Defaults gracefully to full energy when bodyState is omitted
    sensor.sample(baseCtx, bus.writer);
    bus.swap();
    expect(bus.reader.get(outH.level)).toBe(1);
    expect(bus.reader.get(outH.deficit)).toBe(0);
  });
});
