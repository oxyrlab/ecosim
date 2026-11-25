import { describe, expect, it } from 'vitest';
import { port } from '@bus/ports';
import { unmergedFanInRule } from './unmerged-fan-in';

describe('unmergedFanInRule', () => {
  it('flags fan-in targeting an input without merge policy', () => {
    const params = unmergedFanInRule.params.parse({});
    const bare = { body: { parts: [{ id: 'torso', shape: { type: 'circle', r: 0.2 } }] } };
    expect(unmergedFanInRule.check(bare, params, {})).toEqual([]);

    const bad = {
      ...bare,
      nervousGraph: {
        endpoints: [
          { instanceId: 'a', inputs: {}, outputs: { out: port.analog({ description: 'a' }) } },
          { instanceId: 'b', inputs: {}, outputs: { out: port.analog({ description: 'b' }) } },
          {
            instanceId: 'c',
            inputs: { inp: port.analog({ description: 'no merge' }) },
            outputs: {},
          },
        ],
        wires: [{ from: ['a:out', 'b:out'], to: 'c:inp' }],
      },
    };
    const violations = unmergedFanInRule.check(bad, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.ruleId).toBe('unmerged-fan-in');
  });
});
