import { describe, expect, it } from 'vitest';
import { port } from '@bus/ports';
import { unconnectedInputRule } from './unconnected-input';

describe('unconnectedInputRule', () => {
  it('reports input ports with zero incoming wires', () => {
    const params = unconnectedInputRule.params.parse({});
    const bare = { body: { parts: [{ id: 'torso', shape: { type: 'circle', r: 0.2 } }] } };
    expect(unconnectedInputRule.check(bare, params, {})).toEqual([]);

    const subject = {
      ...bare,
      nervousGraph: {
        endpoints: [
          { instanceId: 'a', inputs: {}, outputs: { out: port.analog({ description: 'a' }) } },
          {
            instanceId: 'b',
            inputs: {
              wired: port.analog({ description: 'wired' }),
              dangling: port.analog({ description: 'dangling' }),
            },
            outputs: {},
          },
        ],
        wires: [{ from: 'a:out', to: 'b:wired' }],
      },
    };
    const violations = unconnectedInputRule.check(subject, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.path).toBe('wiring.b:dangling');
  });
});
