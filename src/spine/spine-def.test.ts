import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { port } from '@bus/ports';
import { createRegistry, InvalidParameterError } from '@core/index';
import { defineSpine, registerSpine, type SpineDef } from './spine-def';

describe('spine-def', () => {
  it('validates metadata and registers spines', () => {
    const local = createRegistry<SpineDef<unknown>>('spine');
    const spine = defineSpine({
      id: 'direct-spine',
      description: 'Direct motor mapper.',
      params: z.object({}),
      inputs: { forward: port.analog({ range: [-1, 1], description: 'fwd' }) },
      outputs: { power: port.analog({ range: [-1, 1], description: 'pwr' }) },
      create(_params, { inputs, outputs }) {
        return {
          tick(input, output) {
            output.set(outputs.power, input.get(inputs.forward));
          },
        };
      },
    });
    registerSpine(spine, local);
    expect(local.has('direct-spine')).toBe(true);

    expect(() => defineSpine({ ...spine, id: 'BadId' })).toThrow(InvalidParameterError);
    expect(() => defineSpine({ ...spine, description: '' })).toThrow(InvalidParameterError);
  });
});
