import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { port } from '@bus/ports';
import { createRegistry, InvalidParameterError } from '@core/index';
import { defineActuator, registerActuator, type ActuatorDef } from './actuator-def';

describe('actuator-def', () => {
  it('validates metadata and registers actuators', () => {
    const local = createRegistry<ActuatorDef<unknown>>('actuator');
    const act = defineActuator({
      id: 'pulse-jet',
      description: 'Simple test thruster.',
      params: z.object({ power: z.number().positive().default(5) }),
      inputs: { thrust: port.analog({ range: [0, 1], description: 'thrust' }) },
      energyCost: (p) => ({
        basePerSecond: 0,
        perUnitEffortPerSecond: p.power * 0.1,
        perAction: 0,
      }),
      create(params, { inputs }) {
        return {
          apply(ctx, input, dt) {
            const p = input.get(inputs.thrust);
            ctx.applyForce({ x: p * params.power, y: 0 });
            ctx.consumeEnergy(p * params.power * 0.1 * dt);
          },
        };
      },
    });
    registerActuator(act, local);
    expect(local.has('pulse-jet')).toBe(true);

    expect(() => defineActuator({ ...act, id: 'BadId' })).toThrow(InvalidParameterError);
    expect(() => defineActuator({ ...act, description: '  ' })).toThrow(InvalidParameterError);
  });
});
