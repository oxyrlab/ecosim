import { describe, expect, it } from 'vitest';
import {
  BlueprintValidationError,
  DuplicateRegistrationError,
  EcoSimError,
  InvalidParameterError,
  InvariantViolationError,
  RegistryNotFoundError,
  RuleViolationError,
  WiringError,
} from './errors';

describe('errors', () => {
  it('sets name, code, and message on EcoSimError', () => {
    const error = new EcoSimError('CUSTOM_CODE', 'something went wrong');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(EcoSimError);
    expect(error.name).toBe('EcoSimError');
    expect(error.code).toBe('CUSTOM_CODE');
    expect(error.message).toBe('something went wrong');
  });

  it('formats InvalidParameterError with optional context and unserializable values', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    const withContext = new InvalidParameterError('rate', -1, 'a number >= 0', 'metabolism');
    expect(withContext.code).toBe('INVALID_PARAMETER');
    expect(withContext.parameter).toBe('rate');
    expect(withContext.value).toBe(-1);
    expect(withContext.expected).toBe('a number >= 0');
    expect(withContext.message).toContain('in metabolism');

    const withString = new InvalidParameterError('id', 'Bad_Id', 'kebab-case');
    expect(withString.message).toContain('"Bad_Id"');

    const withCircular = new InvalidParameterError('obj', circular, 'plain object');
    expect(withCircular.message).toContain('[object Object]');

    const withObj = new InvalidParameterError('pair', [1, 2], 'single value');
    expect(withObj.message).toContain('[1,2]');
  });

  it('formats DuplicateRegistrationError and RegistryNotFoundError', () => {
    const duplicate = new DuplicateRegistrationError('sensor', 'vision-sensor');
    expect(duplicate.code).toBe('DUPLICATE_REGISTRATION');
    expect(duplicate.registryName).toBe('sensor');
    expect(duplicate.id).toBe('vision-sensor');
    expect(duplicate.message).toContain('vision-sensor');

    const missingWithIds = new RegistryNotFoundError('sensor', 'sonar', ['vision-sensor', 'nose']);
    expect(missingWithIds.code).toBe('REGISTRY_NOT_FOUND');
    expect(missingWithIds.availableIds).toEqual(['vision-sensor', 'nose']);
    expect(missingWithIds.message).toContain('vision-sensor, nose');

    const missingEmpty = new RegistryNotFoundError('sensor', 'sonar', []);
    expect(missingEmpty.message).toContain('empty');
  });

  it('formats BlueprintValidationError and WiringError', () => {
    const withPath = new BlueprintValidationError('missing torso', 'body.parts');
    expect(withPath.path).toBe('body.parts');
    expect(withPath.message).toContain('body.parts');

    const withoutPath = new BlueprintValidationError('invalid genome');
    expect(withoutPath.path).toBeUndefined();
    expect(withoutPath.message).toContain('invalid genome');

    const both = new WiringError('type mismatch', 'eye:out', 'brain:in');
    expect(both.message).toContain('eye:out -> brain:in');

    const sourceOnly = new WiringError('unknown port', 'eye:bad');
    expect(sourceOnly.message).toContain('from eye:bad');

    const targetOnly = new WiringError('unmerged fan-in', undefined, 'fear:pain');
    expect(targetOnly.message).toContain('to fear:pain');

    const neither = new WiringError('empty wiring table');
    expect(neither.message).toBe('Signal wiring error: empty wiring table');
  });

  it('formats RuleViolationError and InvariantViolationError', () => {
    const err = new RuleViolationError('Blueprint rejected', [
      {
        ruleId: 'min-collider-size',
        severity: 'error',
        message: 'radius too small',
        path: 'body.parts[0].shape',
      },
      {
        ruleId: 'no-nan-state',
        severity: 'error',
        message: 'energy is NaN',
      },
    ]);
    expect(err.code).toBe('RULE_VIOLATION');
    expect(err.violations).toHaveLength(2);
    expect(err.message).toContain('(min-collider-size) [body.parts[0].shape]: radius too small');
    expect(err.message).toContain('(no-nan-state): energy is NaN');

    const emptyErr = new RuleViolationError('Locked rule override', []);
    expect(emptyErr.message).toBe('Locked rule override');

    const invariant = new InvariantViolationError('dead entity mutated');
    expect(invariant.code).toBe('INVARIANT_VIOLATION');
    expect(invariant.message).toContain('dead entity mutated');
  });
});
