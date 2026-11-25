import { describe, expect, it } from 'vitest';
import { port } from '@bus/ports';
import { maxBusChannelsRule } from './max-bus-channels';

describe('maxBusChannelsRule', () => {
  it('flags SignalBus allocations exceeding max channel budget', () => {
    const params = maxBusChannelsRule.params.parse({ max: 4 });
    const bare = { body: { parts: [{ id: 'torso', shape: { type: 'circle', r: 0.2 } }] } };
    expect(maxBusChannelsRule.check(bare, params, {})).toEqual([]);

    const heavy = {
      ...bare,
      nervousGraph: {
        endpoints: [
          {
            instanceId: 'eye',
            inputs: {},
            outputs: { sectors: port.analog({ count: 8, description: 'sectors' }) },
          },
        ],
        wires: [],
      },
    };
    const violations = maxBusChannelsRule.check(heavy, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.actual).toBe(8);
  });
});
