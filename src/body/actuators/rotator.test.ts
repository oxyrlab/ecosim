import { describe, expect, it, vi } from 'vitest';
import { resolvePortMap } from '@body/sensors/sensor-def';
import type { PortHandle } from '@bus/ports';
import { resolveWiring } from '@bus/wiring';
import { createEntityId } from '@core/index';
import type { ActuatorContext } from './actuator-def';
import { rotatorActuator } from './rotator';

describe('rotatorActuator', () => {
  it('applies scaled torque and deducts energy', () => {
    const params = rotatorActuator.params.parse({
      maxTorqueNewtonMeters: 4,
      energyPerTorqueSecond: 0.05,
    });
    const { bus, handles } = resolveWiring(
      [
        {
          instanceId: 'src',
          inputs: {},
          outputs: { turn: { kind: 'analog', range: [-1, 1], description: 'turn' } },
        },
        { instanceId: 'rot', inputs: resolvePortMap(rotatorActuator.inputs, params), outputs: {} },
      ],
      [{ from: 'src:turn', to: 'rot:turn' }],
    );

    const srcTurn = handles.get('src')?.outputs['turn'] as PortHandle;
    const rotInputs = handles.get('rot')?.inputs as { turn: PortHandle };
    const actuator = rotatorActuator.create(params, { inputs: rotInputs });

    const applyTorque = vi.fn();
    const consumeEnergy = vi.fn();
    const ctx: ActuatorContext = {
      entityId: createEntityId(1),
      worldPosition: { x: 0, y: 0 },
      worldAngle: 0,
      applyForce: vi.fn(),
      applyImpulse: vi.fn(),
      applyTorque,
      emitField: vi.fn(),
      consumeEnergy,
      emitAction: vi.fn(),
    };

    bus.writer.set(srcTurn, -0.5);
    bus.swap();
    actuator.apply(ctx, bus.reader, 0.25);

    expect(applyTorque).toHaveBeenCalledWith(-2);
    expect(consumeEnergy).toHaveBeenCalledWith(0.025);
    expect(rotatorActuator.energyCost(params).perUnitEffortPerSecond).toBeCloseTo(0.2);

    // Juvenile bodyScale = 0.5 scales torque by s^4 = 0.0625 and damps excess angularVelocity
    applyTorque.mockClear();
    actuator.apply({ ...ctx, bodyScale: 0.5, angularVelocity: -2.1 }, bus.reader, 0.25);
    expect(applyTorque).not.toHaveBeenCalled(); // already at targetOmega = -0.5 * 4.2 = -2.1 rad/s

    actuator.apply({ ...ctx, bodyScale: 0.5, angularVelocity: -6.3 }, bus.reader, 0.25);
    expect(applyTorque).toHaveBeenCalledTimes(1);
    expect(applyTorque.mock.calls[0]?.[0]).toBeCloseTo(0.25, 6); // braking torque capped at 4 * 0.5^4 = 0.25 N*m
  });
});
