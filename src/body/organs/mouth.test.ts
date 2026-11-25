import { describe, expect, it } from 'vitest';
import { mouthOrgan } from './mouth';

describe('mouthOrgan', () => {
  it('declares valid mouth metadata with actuator slot enabled', () => {
    expect(mouthOrgan.id).toBe('mouth');
    expect(mouthOrgan.actuatorSlot).toBe(true);
    expect(mouthOrgan.params.parse(undefined)).toEqual({});
  });
});
