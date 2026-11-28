import { describe, expect, it, vi } from 'vitest';
import { resolvePortMap } from '@body/sensors/sensor-def';
import type { PortHandle } from '@bus/ports';
import { resolveWiring } from '@bus/wiring';
import { createEntityId } from '@core/index';
import type { ActuatorContext } from './actuator-def';
import { thrusterActuator } from './thruster';

describe('thrusterActuator', () => {
  it('applies directional force at mount position and deducts proportional energy', () => {
    const params = thrusterActuator.params.parse({
      maxForceNewtons: 10,
      energyPerNewtonSecond: 0.1,
    });
    const { bus, handles } = resolveWiring(
      [
        {
          instanceId: 'src',
          inputs: {},
          outputs: { cmd: { kind: 'analog', range: [-1, 1], description: 'cmd' } },
        },
        {
          instanceId: 'thrust',
          inputs: resolvePortMap(thrusterActuator.inputs, params),
          outputs: {},
        },
      ],
      [{ from: 'src:cmd', to: 'thrust:power' }],
    );

    const srcCmd = handles.get('src')?.outputs['cmd'] as PortHandle;
    const thrustInputs = handles.get('thrust')?.inputs as { power: PortHandle };
    const actuator = thrusterActuator.create(params, { inputs: thrustInputs });

    const applyForce = vi.fn();
    const consumeEnergy = vi.fn();
    const ctx: ActuatorContext = {
      entityId: createEntityId(1),
      worldPosition: { x: 2, y: -0.3 },
      worldAngle: 0,
      applyForce,
      applyImpulse: vi.fn(),
      applyTorque: vi.fn(),
      emitField: vi.fn(),
      consumeEnergy,
      emitAction: vi.fn(),
    };

    actuator.apply(ctx, bus.reader, 0.5);
    expect(applyForce).not.toHaveBeenCalled();
    expect(consumeEnergy).not.toHaveBeenCalled();

    bus.writer.set(srcCmd, 0.5);
    bus.swap();
    actuator.apply(ctx, bus.reader, 0.5);

    expect(applyForce).toHaveBeenCalledWith({ x: 5, y: 0 }, { x: 2, y: -0.3 });
    expect(consumeEnergy).toHaveBeenCalledWith(0.25);
    expect(thrusterActuator.energyCost(params).perUnitEffortPerSecond).toBe(1);

    // Juvenile bodyScale = 0.5 scales force by s^2 = 0.25
    applyForce.mockClear();
    actuator.apply({ ...ctx, bodyScale: 0.5 }, bus.reader, 0.5);
    expect(applyForce).toHaveBeenCalledWith({ x: 1.25, y: 0 }, { x: 2, y: -0.3 });
  });
});
