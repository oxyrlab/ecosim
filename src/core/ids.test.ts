import { describe, expect, it } from 'vitest';
import { InvalidParameterError } from './errors';
import { assertKebabCaseId, createEntityId, createEntityIdGenerator, isKebabCaseId } from './ids';

describe('ids', () => {
  it('accepts valid kebab-case ids and rejects invalid formats', () => {
    expect(isKebabCaseId('rabbit')).toBe(true);
    expect(isKebabCaseId('vision-sensor')).toBe(true);
    expect(isKebabCaseId('rule-2d-v1')).toBe(true);

    expect(isKebabCaseId('')).toBe(false);
    expect(isKebabCaseId('VisionSensor')).toBe(false);
    expect(isKebabCaseId('vision_sensor')).toBe(false);
    expect(isKebabCaseId('-leading')).toBe(false);
    expect(isKebabCaseId('trailing-')).toBe(false);
    expect(isKebabCaseId('double--hyphen')).toBe(false);
    expect(isKebabCaseId('9-starts-with-digit')).toBe(false);
  });

  it('assertKebabCaseId returns valid id and throws InvalidParameterError otherwise', () => {
    expect(assertKebabCaseId('body-core', 'organ id')).toBe('body-core');
    expect(() => assertKebabCaseId('Bad_Id', 'organ id')).toThrow(InvalidParameterError);
  });

  it('creates validated positive EntityIds', () => {
    expect(createEntityId(1)).toBe(1);
    expect(createEntityId(42)).toBe(42);
    expect(() => createEntityId(0)).toThrow(InvalidParameterError);
    expect(() => createEntityId(-5)).toThrow(InvalidParameterError);
    expect(() => createEntityId(1.5)).toThrow(InvalidParameterError);
    expect(() => createEntityId(Number.NaN)).toThrow(InvalidParameterError);
  });

  it('generates sequential deterministic EntityIds', () => {
    const gen = createEntityIdGenerator();
    expect(gen.peek()).toBe(1);
    expect(gen.next()).toBe(1);
    expect(gen.next()).toBe(2);
    expect(gen.peek()).toBe(3);

    const custom = createEntityIdGenerator(10);
    expect(custom.next()).toBe(10);
    expect(custom.next()).toBe(11);

    expect(() => createEntityIdGenerator(0)).toThrow(InvalidParameterError);
    expect(() => createEntityIdGenerator(2.5)).toThrow(InvalidParameterError);
  });
});
