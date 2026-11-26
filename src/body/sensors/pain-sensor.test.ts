import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { resolveWiring } from '@bus/wiring';
import { createEntityId } from '@core/index';
import { painSensor } from './pain-sensor';
import { resolvePortMap, type SensorContext } from './sensor-def';

describe('painSensor', () => {
  it('emits pain pulse and health ratio from bodyState', () => {
    const params = painSensor.params.parse(undefined);
    const outputs = resolvePortMap(painSensor.outputs, params);
    const { bus, handles } = resolveWiring([{ instanceId: 'skin', inputs: {}, outputs }], []);
    const outH = handles.get('skin')?.outputs as { pain: PortHandle; health: PortHandle };
    const sensor = painSensor.create(params, { outputs: outH });

    const baseCtx: SensorContext = {
      entityId: createEntityId(1),
      position: { x: 0, y: 0 },
      angle: 0,
      queryNeighbors: () => [],
      sampleField: () => 0,
      castRay: () => null,
    };

    sensor.sample(
      { ...baseCtx, bodyState: { energyRatio: 0.8, healthRatio: 0.6, painPulse: 0.4 } },
      bus.writer,
    );
    bus.swap();
    expect(bus.reader.get(outH.pain)).toBeCloseTo(0.4);
    expect(bus.reader.get(outH.health)).toBeCloseTo(0.6);

    sensor.sample(baseCtx, bus.writer);
    bus.swap();
    expect(bus.reader.get(outH.pain)).toBe(0);
    expect(bus.reader.get(outH.health)).toBe(1);
  });
});
