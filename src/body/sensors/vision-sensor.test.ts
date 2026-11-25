import { describe, expect, it } from 'vitest';
import type { PortHandle } from '@bus/ports';
import { resolveWiring } from '@bus/wiring';
import { createEntityId } from '@core/index';
import { resolvePortMap, type NeighborObservation, type SensorContext } from './sensor-def';
import { visionSensor } from './vision-sensor';

function makeContext(
  neighbors: readonly NeighborObservation[],
  castRayImpl?: SensorContext['castRay'],
): SensorContext {
  return {
    entityId: createEntityId(1),
    position: { x: 0, y: 0 },
    angle: 0,
    queryNeighbors: () => neighbors,
    sampleField: () => 0,
    castRay: castRayImpl ?? (() => null),
  };
}

describe('visionSensor', () => {
  it('bins visible neighbors into sectors, ignores self/out-of-FOV, and computes tag bearings', () => {
    const params = visionSensor.params.parse({
      rangeMeters: 10,
      fovRadians: Math.PI / 2,
      sectors: 4,
      tags: ['plant', 'predator'],
    });
    const outputs = resolvePortMap(visionSensor.outputs, params);
    const { bus, handles } = resolveWiring([{ instanceId: 'eye', inputs: {}, outputs }], []);
    const eyeHandles = handles.get('eye')?.outputs as Record<string, PortHandle>;
    const instance = visionSensor.create(params, { outputs: eyeHandles });

    const ctx = makeContext([
      {
        entityId: createEntityId(1),
        position: { x: 0, y: 0 },
        radius: 0.4,
        tags: new Set(['plant']),
      },
      {
        entityId: createEntityId(2),
        position: { x: -3, y: 0 },
        radius: 0.5,
        tags: new Set(['plant']),
      },
      {
        entityId: createEntityId(3),
        position: { x: 5, y: 2 },
        radius: 0.5,
        tags: new Set(['plant']),
      },
      {
        entityId: createEntityId(4),
        position: { x: 4, y: -1 },
        radius: 1.0,
        tags: new Set(['predator']),
      },
    ]);

    instance.sample(ctx, bus.writer);
    bus.swap();

    expect(bus.reader.get(eyeHandles['seen.plant'] as PortHandle)).toBeGreaterThan(0.4);
    expect(bus.reader.get(eyeHandles['dir.plant'] as PortHandle)).toBeGreaterThan(0);
    expect(bus.reader.get(eyeHandles['seen.predator'] as PortHandle)).toBeGreaterThan(0.5);
    expect(bus.reader.get(eyeHandles['dir.predator'] as PortHandle)).toBeLessThan(0);

    instance.sample(makeContext([]), bus.writer);
    bus.swap();
    for (let s = 0; s < 4; s += 1) {
      expect(bus.reader.get(eyeHandles['sector.distance'] as PortHandle, s)).toBe(1);
    }
    expect(bus.reader.get(eyeHandles['seen.plant'] as PortHandle)).toBe(0);
  });

  it('respects raycast occlusion when occlusion is "raycast"', () => {
    const params = visionSensor.params.parse({
      rangeMeters: 10,
      fovRadians: Math.PI / 2,
      sectors: 4,
      tags: ['plant'],
      occlusion: 'raycast',
    });
    const outputs = resolvePortMap(visionSensor.outputs, params);
    const { bus, handles } = resolveWiring([{ instanceId: 'eye', inputs: {}, outputs }], []);
    const eyeHandles = handles.get('eye')?.outputs as Record<string, PortHandle>;
    const instance = visionSensor.create(params, { outputs: eyeHandles });

    const occludedCtx = makeContext(
      [
        {
          entityId: createEntityId(5),
          position: { x: 6, y: 0 },
          radius: 0.4,
          tags: new Set(['plant']),
        },
      ],
      () => ({ entityId: createEntityId(99), distance: 2 }),
    );
    instance.sample(occludedCtx, bus.writer);
    bus.swap();
    expect(bus.reader.get(eyeHandles['seen.plant'] as PortHandle)).toBe(0);
  });
});
