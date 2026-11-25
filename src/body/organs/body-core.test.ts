import { describe, expect, it } from 'vitest';
import { bodyCoreOrgan } from './body-core';

describe('bodyCoreOrgan', () => {
  it('declares valid torso metadata and default params', () => {
    expect(bodyCoreOrgan.id).toBe('body-core');
    expect(bodyCoreOrgan.defaultShape.type).toBe('ellipse');
    expect(bodyCoreOrgan.params.parse(undefined)).toEqual({});
  });
});
