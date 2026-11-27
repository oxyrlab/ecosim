import { describe, expect, it } from 'vitest';
import { learningMaxUpdatesPerSecondRule } from './learning-max-updates-per-second';

describe('learning-max-updates-per-second rule', () => {
  it('passes for event-driven rates and warns when update rate exceeds max', () => {
    expect(learningMaxUpdatesPerSecondRule.check({ updatesPerSecond: 4 }, { max: 20 }, {})).toEqual(
      [],
    );
    expect(
      learningMaxUpdatesPerSecondRule.check({ updatesPerSecond: 30 }, { max: 20 }, {}),
    ).toHaveLength(1);
  });
});
