import { describe, expect, it } from 'vitest';
import { maxMassRatioJointedRule } from './max-mass-ratio-jointed';
import type { BlueprintBodySubject } from './subject';

describe('maxMassRatioJointedRule', () => {
  it('reports joints connecting bodies whose mass ratio exceeds maxRatio', () => {
    const params = maxMassRatioJointedRule.params.parse({ maxRatio: 10 });
    const balanced: BlueprintBodySubject = {
      body: {
        parts: [
          { id: 'torso', shape: { type: 'circle', r: 0.3 } },
          {
            id: 'tail',
            parent: 'torso',
            at: 'back',
            pivot: 'front',
            joint: { type: 'revolute' },
            shape: { type: 'circle', r: 0.15 },
          },
        ],
      },
    };
    expect(maxMassRatioJointedRule.check(balanced, params, {})).toEqual([]);

    const extreme: BlueprintBodySubject = {
      body: {
        parts: [
          { id: 'torso', shape: { type: 'circle', r: 1.0 } },
          {
            id: 'tiny-tail',
            parent: 'torso',
            at: 'back',
            pivot: 'front',
            joint: { type: 'revolute' },
            shape: { type: 'circle', r: 0.05 },
          },
        ],
      },
    };
    const violations = maxMassRatioJointedRule.check(extreme, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.ruleId).toBe('max-mass-ratio-jointed');
  });
});
