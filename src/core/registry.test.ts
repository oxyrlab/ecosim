import { describe, expect, it } from 'vitest';
import { DuplicateRegistrationError, InvalidParameterError, RegistryNotFoundError } from './errors';
import { createRegistry } from './registry';

interface SampleDef {
  readonly id: string;
  readonly value: number;
}

describe('registry', () => {
  it('registers, retrieves, lists, and clears entries deterministically', () => {
    const registry = createRegistry<SampleDef>('sample');
    expect(registry.name).toBe('sample');
    expect(registry.size).toBe(0);

    const a = registry.register({ id: 'alpha-one', value: 1 });
    const b = registry.register({ id: 'beta-two', value: 2 });

    expect(a.value).toBe(1);
    expect(registry.size).toBe(2);
    expect(registry.has('alpha-one')).toBe(true);
    expect(registry.has('missing')).toBe(false);
    expect(registry.get('beta-two')).toBe(b);
    expect(registry.tryGet('alpha-one')).toBe(a);
    expect(registry.tryGet('missing')).toBeUndefined();
    expect(registry.ids()).toEqual(['alpha-one', 'beta-two']);
    expect(registry.list()).toEqual([a, b]);

    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
  });

  it('rejects non-kebab-case ids, duplicates, and unknown lookups', () => {
    const registry = createRegistry<SampleDef>('sensor');
    expect(() => registry.register({ id: 'BadId', value: 1 })).toThrow(InvalidParameterError);

    registry.register({ id: 'vision-sensor', value: 1 });
    expect(() => registry.register({ id: 'vision-sensor', value: 2 })).toThrow(
      DuplicateRegistrationError,
    );
    expect(() => registry.get('unknown-sensor')).toThrow(RegistryNotFoundError);
  });
});
