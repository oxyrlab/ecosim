import { describe, expect, it } from 'vitest';
import { eyeOrgan } from './eye';

describe('eyeOrgan', () => {
  it('declares valid eye metadata and sensor slot capacity', () => {
    expect(eyeOrgan.id).toBe('eye');
    expect(eyeOrgan.sensorSlots).toBe(1);
    expect(eyeOrgan.actuatorSlot).toBe(false);
    expect(eyeOrgan.params.parse(undefined)).toEqual({});
  });
});
