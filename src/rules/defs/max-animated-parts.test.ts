import { describe, expect, it } from 'vitest';
import { maxAnimatedPartsRule } from './max-animated-parts';

describe('maxAnimatedPartsRule', () => {
  it('counts expanded parts carrying visual animations', () => {
    const params = maxAnimatedPartsRule.params.parse({ max: 1 });
    const oneAnim = {
      body: {
        parts: [
          { id: 'torso', shape: { type: 'circle', r: 0.2 } },
          {
            id: 'tail',
            parent: 'torso',
            shape: { type: 'capsule', length: 0.1, radius: 0.03 },
            anim: [{ kind: 'wag' as const, channel: 'fear:level', amplitude: 0.3 }],
          },
        ],
      },
    };
    expect(maxAnimatedPartsRule.check(oneAnim, params, {})).toEqual([]);

    const mirroredAnim = {
      body: {
        parts: [
          { id: 'torso', shape: { type: 'circle', r: 0.2 } },
          {
            id: 'wing',
            parent: 'torso',
            mirror: true,
            joint: 'visual' as const,
            shape: { type: 'triangle', w: 0.2, h: 0.1 },
            anim: [{ kind: 'swing' as const, channel: 'move:forward', amplitude: 0.4 }],
          },
        ],
      },
    };
    const violations = maxAnimatedPartsRule.check(mirroredAnim, params, {});
    expect(violations).toHaveLength(1);
    expect(violations[0]?.actual).toBe(2);
  });
});
