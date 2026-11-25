import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { port } from '@bus/ports';
import { createRegistry, InvalidParameterError } from '@core/index';
import { defineBrainModule, registerBrainModule, type BrainModuleDef } from './module-def';

describe('brain module-def', () => {
  it('validates metadata and registers brain modules', () => {
    const local = createRegistry<BrainModuleDef<unknown>>('brain-module');
    const mod = defineBrainModule({
      id: 'pass-through',
      kind: 'rule',
      description: 'Copies input directly to output.',
      params: z.object({ gain: z.number().default(1) }),
      inputs: { signal: port.analog({ range: [-1, 1], description: 'in' }) },
      outputs: { signal: port.analog({ range: [-1, 1], description: 'out' }) },
      create(params, { inputs, outputs }) {
        return {
          tick(input, output) {
            output.set(outputs.signal, input.get(inputs.signal) * params.gain);
          },
        };
      },
    });
    registerBrainModule(mod, local);
    expect(local.has('pass-through')).toBe(true);

    expect(() => defineBrainModule({ ...mod, id: 'BadId' })).toThrow(InvalidParameterError);
    expect(() => defineBrainModule({ ...mod, description: '  ' })).toThrow(InvalidParameterError);
  });
});
