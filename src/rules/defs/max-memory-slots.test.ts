import { describe, expect, it } from 'vitest';
import { maxMemorySlotsRule } from './max-memory-slots';

describe('max-memory-slots rule', () => {
  it('passes when memorySlots <= max and flags excess slots', () => {
    expect(
      maxMemorySlotsRule.check(
        {
          body: { parts: [] },
          brain: { modules: [{ instanceId: 'm', params: { memorySlots: 8 } }] },
        },
        { max: 16 },
        {},
      ),
    ).toEqual([]);
    expect(
      maxMemorySlotsRule.check(
        {
          body: { parts: [] },
          brain: { modules: [{ instanceId: 'm', params: { memorySlots: 24 } }] },
        },
        { max: 16 },
        {},
      ),
    ).toHaveLength(1);
  });
});
