import { describe, expect, it } from 'vitest';
import { BUILTIN_RULES } from '@rules/defs';
import { DEFAULT_RULE_CONFIG } from './rules.default';

describe('DEFAULT_RULE_CONFIG', () => {
  it('is frozen and provides defaults for every built-in rule', () => {
    expect(Object.isFrozen(DEFAULT_RULE_CONFIG)).toBe(true);
    for (const rule of BUILTIN_RULES) {
      expect(DEFAULT_RULE_CONFIG[rule.id]).toBeDefined();
    }
  });
});
