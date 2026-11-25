import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { port } from '@bus/ports';
import { createRegistry, InvalidParameterError } from '@core/index';
import { defineSensor, registerSensor, resolvePortMap, type SensorDef } from './sensor-def';

describe('sensor-def', () => {
  it('validates metadata, resolves static/dynamic ports, and registers sensors', () => {
    const local = createRegistry<SensorDef<unknown>>('sensor');
    const sensor = defineSensor({
      id: 'temp-sensor',
      description: 'Reads local ambient temperature.',
      params: z.object({ scale: z.number().default(1) }),
      outputs: (p) => ({
        reading: port.analog({ range: [0, p.scale], description: 'temperature' }),
      }),
      create(_params, { outputs }) {
        return {
          sample(_ctx, out) {
            out.set(outputs.reading, 0.5);
          },
        };
      },
    });

    registerSensor(sensor, local);
    expect(local.has('temp-sensor')).toBe(true);
    expect(resolvePortMap(sensor.outputs, { scale: 2 }).reading.range).toEqual([0, 2]);
    expect(resolvePortMap({ x: port.analog({ description: 'x' }) }, {}).x.kind).toBe('analog');

    expect(() => defineSensor({ ...sensor, id: 'BadId' })).toThrow(InvalidParameterError);
    expect(() => defineSensor({ ...sensor, description: '' })).toThrow(InvalidParameterError);
  });
});
