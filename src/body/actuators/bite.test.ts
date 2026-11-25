import { describe, expect, it, vi } from 'vitest';
import { resolvePortMap } from '@body/sensors/sensor-def';
import type { PortHandle } from '@bus/ports';
import { resolveWiring } from '@bus/wiring';
import { createEntityId } from '@core/index';
import type { ActuatorContext } from './actuator-def';
import { biteActuator } from './bite';

describe('biteActuator', () => {
  it('emits bite action on trigger pulse, respects cooldown, and deducts per-bite energy', () => {
    const params = biteActuator.params.parse({
      damage: 15,
      rangeMeters: 0.5,
      cooldownSeconds: 0.4,
      energyCostPerBite: 2,
    });
    const { bus, handles } = resolveWiring(
      [
        {
          instanceId: 'src',
          inputs: {},
          outputs: { bite: { kind: 'pulse', range: [0, 1], description: 'bite' } },
        },
        { instanceId: 'mouth', inputs: resolvePortMap(biteActuator.inputs, params), outputs: {} },
      ],
      [{ from: 'src:bite', to: 'mouth:trigger' }],
    );

    const srcBite = handles.get('src')?.outputs['bite'] as PortHandle;
    const mouthInputs = handles.get('mouth')?.inputs as { trigger: PortHandle };
    const actuator = biteActuator.create(params, { inputs: mouthInputs });

    const emitAction = vi.fn();
    const consumeEnergy = vi.fn();
    const ctx: ActuatorContext = {
      entityId: createEntityId(7),
      worldPosition: { x: 1, y: 2 },
      worldAngle: 0,
      applyForce: vi.fn(),
      applyImpulse: vi.fn(),
      applyTorque: vi.fn(),
      emitField: vi.fn(),
      consumeEnergy,
      emitAction,
    };

    bus.writer.set(srcBite, 1);
    bus.swap();
    actuator.apply(ctx, bus.reader, 0.1);
    expect(emitAction).toHaveBeenCalledTimes(1);
    expect(consumeEnergy).toHaveBeenCalledWith(2);

    bus.writer.set(srcBite, 1);
    bus.swap();
    actuator.apply(ctx, bus.reader, 0.2);
    expect(emitAction).toHaveBeenCalledTimes(1);

    bus.writer.set(srcBite, 1);
    bus.swap();
    actuator.apply(ctx, bus.reader, 0.25);
    expect(emitAction).toHaveBeenCalledTimes(2);
    expect(biteActuator.energyCost(params).perAction).toBe(2);
  });
});
