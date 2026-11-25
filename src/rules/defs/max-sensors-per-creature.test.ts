import { describe, expect, it } from 'vitest';
import { maxSensorsPerCreatureRule } from './max-sensors-per-creature';

describe('maxSensorsPerCreatureRule', () => {
  it('counts expanded sensor instances including mirrored parts', () => {
    const params = maxSensorsPerCreatureRule.params.parse({ max: 2 });
    const ok = {
      body: {
        parts: [
          { id: 'torso', shape: { type: 'circle', r: 0.2 } },
          {
            id: 'eye',
            parent: 'torso',
            mirror: true,
            shape: { type: 'circle', r: 0.04 },
            sensors: [{ instanceId: 'vis', sensor: 'vision-sensor' }],
          },
        ],
      },
    };
    expect(maxSensorsPerCreatureRule.check(ok, params, {})).toEqual([]);

    const tooMany = {
      body: {
        parts: [
          ...ok.body.parts,
          {
            id: 'nose',
            parent: 'torso',
            shape: { type: 'circle', r: 0.04 },
            sensors: [{ instanceId: 'smell', sensor: 'olfactory-sensor' }],
          },
        ],
      },
    };
    const violations = maxSensorsPerCreatureRule.check(tooMany, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.actual).toBe(3);
  });
});
