import { describe, expect, it } from 'vitest';
import { port } from '@bus/ports';
import { numericIndexOnLogicalPortRule } from './numeric-index-on-logical-port';

describe('numericIndexOnLogicalPortRule', () => {
  it('flags numeric indexing on scalar logical ports', () => {
    const params = numericIndexOnLogicalPortRule.params.parse({});
    const bare = { body: { parts: [{ id: 'torso', shape: { type: 'circle', r: 0.2 } }] } };
    expect(numericIndexOnLogicalPortRule.check(bare, params, {})).toEqual([]);

    const bad = {
      ...bare,
      nervousGraph: {
        endpoints: [
          { instanceId: 'a', inputs: {}, outputs: { out: port.analog({ description: 'scalar' }) } },
          { instanceId: 'b', inputs: { inp: port.analog({ description: 'scalar' }) }, outputs: {} },
        ],
        wires: [{ from: 'a:out[0]', to: 'b:inp' }],
      },
    };
    const violations = numericIndexOnLogicalPortRule.check(bad, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.ruleId).toBe('numeric-index-on-logical-port');
  });
});
