import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { resolveWiring } from '@bus/wiring';
import { createEntityId } from '@core/index';
import { GridField } from '@world/field';
import { olfactorySensor } from './olfactory-sensor';
import { resolvePortMap, type SensorContext } from './sensor-def';

describe('olfactorySensor', () => {
  it('samples left/right bilinear points and produces signed gradient pointing toward scent source', () => {
    const field = new GridField({ name: 'scent.plant', cols: 20, rows: 20, cellSizeMeters: 1 });
    field.setCell(10, 12, 8);
    field.diffuse(0.5);
    field.diffuse(0.5);

    const params = olfactorySensor.params.parse({
      channels: ['scent.plant'],
      antennaSpreadMeters: 1.0,
      maxIntensity: 4,
    });
    const outputs = resolvePortMap(olfactorySensor.outputs, params);
    const { bus, handles } = resolveWiring([{ instanceId: 'nose', inputs: {}, outputs }], []);
    const noseHandles = handles.get('nose')?.outputs as Record<string, PortHandle>;
    const sensor = olfactorySensor.create(params, { outputs: noseHandles });

    const ctx: SensorContext = {
      entityId: createEntityId(1),
      position: { x: 10.5, y: 10.5 },
      angle: 0,
      queryNeighbors: () => [],
      sampleField: (_name, x, y) => field.sampleBilinear(x, y),
      castRay: () => null,
    };

    sensor.sample(ctx, bus.writer);
    bus.swap();

    expect(bus.reader.get(noseHandles['intensity.scent.plant'] as PortHandle)).toBeGreaterThan(0);
    expect(bus.reader.get(noseHandles['gradient.scent.plant'] as PortHandle)).toBeGreaterThan(0);

    sensor.sample({ ...ctx, angle: Math.PI }, bus.writer);
    bus.swap();
    expect(bus.reader.get(noseHandles['gradient.scent.plant'] as PortHandle)).toBeLessThan(0);
  });
});
