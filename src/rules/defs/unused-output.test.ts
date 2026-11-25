import { describe, expect, it } from 'vitest';
import { port } from '@bus/ports';
import { unusedOutputRule } from './unused-output';

describe('unusedOutputRule', () => {
  it('reports outputs that are not wired anywhere', () => {
    const params = unusedOutputRule.params.parse({});
    const bare = { body: { parts: [{ id: 'torso', shape: { type: 'circle', r: 0.2 } }] } };
    expect(unusedOutputRule.check(bare, params, {})).toEqual([]);

    const subject = {
      ...bare,
      nervousGraph: {
        endpoints: [
          { instanceId: 'a', inputs: {}, outputs: { dead: port.analog({ description: 'dead' }) } },
        ],
        wires: [],
      },
    };
    const violations = unusedOutputRule.check(subject, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.path).toBe('wiring.a:dead');
  });
});
