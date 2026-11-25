import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRegistry, DuplicateRegistrationError, InvalidParameterError } from '@core/index';
import { defineRule, registerRule } from './define-rule';
import type { RuleDef } from './types';

describe('defineRule & registerRule', () => {
  it('validates metadata and returns the definition unchanged', () => {
    const def = defineRule({
      id: 'max-items',
      description: 'Caps item count.',
      rationale: 'Prevents unbounded per-tick work.',
      scope: 'blueprint',
      category: 'performance',
      defaultSeverity: 'warn',
      params: z.object({ max: z.number().int().positive().default(10) }),
      check(subject: number, params) {
        return subject > params.max
          ? [{ ruleId: 'max-items', severity: 'warn', message: 'too many items' }]
          : [];
      },
    });
    expect(def.id).toBe('max-items');
  });

  it('rejects invalid id, blank description, or blank rationale', () => {
    const base = {
      id: 'valid-rule',
      description: 'desc',
      rationale: 'why it exists',
      scope: 'blueprint' as const,
      category: 'simplicity' as const,
      defaultSeverity: 'warn' as const,
      params: z.object({}),
      check: () => [],
    };

    expect(() => defineRule({ ...base, id: 'InvalidId' })).toThrow(InvalidParameterError);
    expect(() => defineRule({ ...base, description: '   ' })).toThrow(InvalidParameterError);
    expect(() => defineRule({ ...base, rationale: '' })).toThrow(InvalidParameterError);
  });

  it('registers into a provided registry and rejects duplicates', () => {
    const localRegistry = createRegistry<RuleDef<unknown, unknown>>('rule');
    const rule = defineRule({
      id: 'sample-rule',
      description: 'Checks sample.',
      rationale: 'Ensures stability.',
      scope: 'spawn',
      category: 'physics-stability',
      defaultSeverity: 'error',
      params: z.object({ limit: z.number().default(5) }),
      check: () => [],
    });

    registerRule(rule, localRegistry);
    expect(localRegistry.has('sample-rule')).toBe(true);
    expect(() => registerRule(rule, localRegistry)).toThrow(DuplicateRegistrationError);
  });
});
