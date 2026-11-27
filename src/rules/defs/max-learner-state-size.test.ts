import { describe, expect, it } from 'vitest';
import { maxLearnerStateSizeRule } from './max-learner-state-size';

describe('max-learner-state-size rule', () => {
  it('flags learning or NN modules whose estimated float state exceeds max', () => {
    const ok = maxLearnerStateSizeRule.check(
      {
        body: { parts: [] },
        brain: {
          modules: [
            { instanceId: 'mem', module: 'threat-memory', params: { memorySlots: 8 } },
            {
              instanceId: 'nn',
              module: 'nn-controller',
              params: { inputCount: 4, hiddenSizes: [6], outputCount: 2 },
            },
          ],
        },
      },
      { max: 1024 },
      {},
    );
    expect(ok).toEqual([]);

    const bad = maxLearnerStateSizeRule.check(
      {
        body: { parts: [] },
        brain: {
          modules: [{ instanceId: 'huge', module: 'custom', params: { stateSize: 2048 } }],
        },
      },
      { max: 1024 },
      {},
    );
    expect(bad).toHaveLength(1);
  });
});
