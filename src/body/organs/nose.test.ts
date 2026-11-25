import { describe, expect, it } from 'vitest';
import { noseOrgan } from './nose';

describe('noseOrgan', () => {
  it('declares valid nose metadata', () => {
    expect(noseOrgan.id).toBe('nose');
    expect(noseOrgan.sensorSlots).toBe(1);
    expect(noseOrgan.params.parse(undefined)).toEqual({});
  });
});
